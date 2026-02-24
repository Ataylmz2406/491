import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms.functional as TVF
from torchvision import transforms, models
from torchvision.transforms import InterpolationMode
from PIL import Image
import timm
import numpy as np
import io

# --- CONFIGURATION (Matched to Notebook) ---
IMG_SIZE = 576
MEAN_FILL = (124, 116, 104)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
DROP_PATH_RATE = 0.1  # Matched to notebook configuration

# --- CLASS HIERARCHY ---
CLASS_NAMES = [
    'AKIEC', 'BCC', 'BEN_OTH', 'BKL', 'DF', 'INF',
    'MAL_OTH', 'MEL', 'NV', 'SCCKA', 'VASC'
]

# Indices for grouping
try:
    IDX_MEL = CLASS_NAMES.index('MEL')
    IDX_NV  = CLASS_NAMES.index('NV')
except ValueError:
    IDX_MEL = 7 # Default fallback if list order changes
    IDX_NV = 8

# Group 0: Melanocytic | Group 1: Others
GROUPS = {
    0: [IDX_MEL, IDX_NV],
    1: [i for i, c in enumerate(CLASS_NAMES) if c not in ['MEL', 'NV']]
}

CLASS_TO_GROUP = {}
CLASS_TO_SUB   = {}
SUB_HEAD_SIZES = {}

for g_id, cls_list in GROUPS.items():
    SUB_HEAD_SIZES[g_id] = len(cls_list)
    for idx, real_class_id in enumerate(cls_list):
        CLASS_TO_GROUP[real_class_id] = g_id
        CLASS_TO_SUB[real_class_id]   = idx

# --- PREPROCESSING ---
class ResizePad:
    """
    SOTA 'Letterbox' resizing using TVF (TorchVision Functional).
    Strictly matches Milk10kDualDataset implementation.
    """
    def __init__(self, target_size, fill=MEAN_FILL):
        self.target_size = target_size
        self.fill = fill

    def __call__(self, img):
        w, h = img.size

        # 1. Scale
        scale = self.target_size / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)

        # 2. Resize
        img = TVF.resize(img, (new_h, new_w), interpolation=InterpolationMode.BICUBIC)

        # 3. Calculate Pad
        delta_w = self.target_size - new_w
        delta_h = self.target_size - new_h
        padding = (delta_w // 2, delta_h // 2, delta_w - (delta_w // 2), delta_h - (delta_h // 2))

        # 4. Pad
        return TVF.pad(img, padding, fill=self.fill, padding_mode='constant')

def get_inference_transform(img_size=IMG_SIZE):
    return transforms.Compose([
        transforms.Lambda(lambda img: img.convert("RGB")),
        ResizePad(img_size, fill=MEAN_FILL),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

# --- MODEL ARCHITECTURE ---

class AttentionGatedFusion(nn.Module):
    def __init__(self, channels_list, emb_dim=512, dropout=0.2):
        super().__init__()
        self.projs = nn.ModuleList([
            nn.Sequential(
                nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(dropout),
                nn.Linear(ch, emb_dim), nn.BatchNorm1d(emb_dim), nn.SiLU()
            ) for ch in channels_list
        ])
        # Init logits to [-1, 0, 1] so Softmax starts biased to deep features
        n = len(channels_list)
        init_logits = torch.linspace(-1.0, 1.0, steps=n)
        self.weight_logits = nn.Parameter(init_logits)

    def get_weights(self): return F.softmax(self.weight_logits, dim=0)

    def forward(self, features):
        embs = [proj(f) for proj, f in zip(self.projs, features)]
        stack = torch.stack(embs, dim=1)
        w = self.get_weights().view(1, -1, 1)
        return (stack * w).sum(dim=1)

class DualHierarchicalModel(nn.Module):
    def __init__(self, arch='tf_efficientnetv2_xl.in21k_ft_in1k', emb_dim=512, dropout=0.2):
        super().__init__()
        # Use simple creation if drop_path_rate is stored in model args, 
        # but here we hardcode it based on notebook config
        self.clin = timm.create_model(arch, pretrained=False, features_only=True,
                                      out_indices=(2,3,4), drop_path_rate=DROP_PATH_RATE)
        self.derm = timm.create_model(arch, pretrained=False, features_only=True,
                                      out_indices=(2,3,4), drop_path_rate=DROP_PATH_RATE)

        dims = self.clin.feature_info.channels()
        self.clin_gate = AttentionGatedFusion(dims, emb_dim, dropout)
        self.derm_gate = AttentionGatedFusion(dims, emb_dim, dropout)

        # Funnel MLP Architecture (1024 -> 512 -> 256)
        self.fusion_out_dim = 256
        self.fusion = nn.Sequential(
            # Stage 1: Compress 1024 -> 512
            nn.Linear(emb_dim * 2, 512),
            nn.BatchNorm1d(512),
            nn.SiLU(),
            nn.Dropout(dropout),

            # Stage 2: Squeeze 512 -> 256
            nn.Linear(512, self.fusion_out_dim),
            nn.BatchNorm1d(self.fusion_out_dim),
            nn.SiLU(),
            nn.Dropout(dropout)
        )

        # Heads now read from the 256 vector
        self.head_group = nn.Linear(self.fusion_out_dim, 2)
        self.head_mel   = nn.Linear(self.fusion_out_dim, SUB_HEAD_SIZES[0])
        self.head_other = nn.Linear(self.fusion_out_dim, SUB_HEAD_SIZES[1])

    def forward(self, xc, xd):
        # Allow gradients for GradCAM if needed, but usually we use hooks.
        # This forward path is for inference.
        ec = self.clin_gate(self.clin(xc))
        ed = self.derm_gate(self.derm(xd))

        # Concatenate -> Funnel MLP
        fused = self.fusion(torch.cat([ec, ed], dim=1))

        return self.head_group(fused), self.head_mel(fused), self.head_other(fused)

def encode_location(location_str: str):
    """
    Standardizes input from the Frontend to the model's expected 5-class metadata vector.
    Collapses ISIC 2019 granular sites into MILK10k broad categories.
    """
    location_str = str(location_str).lower().strip() if location_str else "other_unknown"
    
    # Handle variations (e.g. if the user sends "anterior torso" by mistake)
    if "torso" in location_str:
        location_str = "torso"
    elif "head" in location_str or "neck" in location_str:
        location_str = "head/neck"
    elif "upper" in location_str or "arm" in location_str or "hand" in location_str:
        location_str = "upper_extremity"
    elif "lower" in location_str or "leg" in location_str or "foot" in location_str:
        location_str = "lower_extremity"
        
    mapping = {
        "head/neck": 0,
        "upper_extremity": 1,
        "lower_extremity": 2,
        "torso": 3,
        "other_unknown": 4
    }
    
    idx = mapping.get(location_str, 4)
    return F.one_hot(torch.tensor(idx), num_classes=5).float()

# --- UTILS for Inference ---

def stitch_predictions(logits_grp, logits_mel, logits_other):
    """
    Combines hierarchical logits into a single flat probability vector for all classes.
    """
    p_grp = F.softmax(logits_grp, dim=1)
    p_mel = F.softmax(logits_mel, dim=1)
    p_oth = F.softmax(logits_other, dim=1)
    
    # Final has 11 classes
    B = logits_grp.size(0)
    final = torch.zeros(B, len(CLASS_NAMES), device=logits_grp.device)
    
    # Fill Group 0 (Melanocytic)
    for i, cid in enumerate(GROUPS[0]): 
        final[:, cid] = p_grp[:, 0] * p_mel[:, i]
        
    # Fill Group 1 (Others)
    for i, cid in enumerate(GROUPS[1]): 
        final[:, cid] = p_grp[:, 1] * p_oth[:, i]
        
    return final

