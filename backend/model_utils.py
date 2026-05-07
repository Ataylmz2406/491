import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from torchvision import transforms
from torchvision.transforms import InterpolationMode
from transformers import Swinv2Config, Swinv2Model


IMG_SIZE = 384
MODEL_ARCHITECTURE = "SwinV2"
MODEL_CHECKPOINT_NAME = "MILK10k_SwinV2_ISICinit_fold4_best.pth"
MODEL_DISPLAY_NAME = "MILK10k SwinV2 ISIC-init Fold 4"
MODEL_TRANSFER_SOURCE = "ISIC initialization"
MODEL_INPUT_MODALITY = "dermoscopic_image"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

CLASS_NAMES = [
    "AKIEC", "BCC", "BEN_OTH", "BKL", "DF", "INF",
    "MAL_OTH", "MEL", "NV", "SCCKA", "VASC"
]

CHECKPOINT_CLASS_NAMES = [name.lower() for name in CLASS_NAMES]
MALIGNANT_CLASSES = {"MEL", "BCC", "SCCKA", "AKIEC", "MAL_OTH"}

UNCERTAIN_TOP_PROB_THRESHOLD = 45.0
UNCERTAIN_MARGIN_THRESHOLD = 15.0
UNCERTAIN_ENTROPY_THRESHOLD = 0.72
REVIEW_PREDICTION_MARGIN_THRESHOLD = 15.0


def get_inference_transform(img_size=IMG_SIZE):
    return transforms.Compose([
        transforms.Lambda(lambda img: img.convert("RGB")),
        transforms.Resize((img_size, img_size), interpolation=InterpolationMode.BICUBIC),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


class GeMTokenPooling(nn.Module):
    def __init__(self, p=3.0, eps=1e-6):
        super().__init__()
        self.p = nn.Parameter(torch.ones(1) * p)
        self.eps = eps

    def forward(self, tokens):
        return tokens.clamp(min=self.eps).pow(self.p).mean(dim=1).pow(1.0 / self.p)


class Milk10kSwinV2Classifier(nn.Module):
    def __init__(
        self,
        num_classes=len(CLASS_NAMES),
        image_size=IMG_SIZE,
        hidden_dim=512,
        head_dropout=0.35,
        feature_dropout=0.1,
        drop_path_rate=0.25,
    ):
        super().__init__()
        config = Swinv2Config(
            image_size=image_size,
            patch_size=4,
            num_channels=3,
            embed_dim=128,
            depths=[2, 2, 18, 2],
            num_heads=[4, 8, 16, 32],
            window_size=24,
            drop_path_rate=drop_path_rate,
            hidden_dropout_prob=0.0,
            attention_probs_dropout_prob=0.0,
            use_absolute_embeddings=False,
        )
        self.backbone = Swinv2Model(config)
        self.token_pool = GeMTokenPooling()
        self.feature_dropout = nn.Dropout(feature_dropout)
        self.head = nn.Sequential(
            nn.BatchNorm1d(1024),
            nn.Linear(1024, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.SiLU(),
            nn.Dropout(head_dropout),
            nn.Linear(hidden_dim, 256),
            nn.BatchNorm1d(256),
            nn.SiLU(),
            nn.Dropout(head_dropout),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        outputs = self.backbone(pixel_values=x, return_dict=True)
        pooled = self.token_pool(outputs.last_hidden_state)
        return self.head(self.feature_dropout(pooled))


def validate_checkpoint_class_order(checkpoint):
    classes = checkpoint.get("classes")
    if classes and [str(item).lower() for item in classes] != CHECKPOINT_CLASS_NAMES:
        raise ValueError(
            "Checkpoint class order does not match API class order: "
            f"{classes} != {CHECKPOINT_CLASS_NAMES}"
        )


def assess_dermoscopic_image_plausibility(image):
    """Flag obvious non-dermoscopic inputs before trusting classifier confidence."""
    resized = image.convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    array = np.asarray(resized, dtype=np.float32) / 255.0
    luminance = array.mean(axis=2)
    saturation_proxy = array.max(axis=2) - array.min(axis=2)
    dx = np.abs(np.diff(luminance, axis=1))
    dy = np.abs(np.diff(luminance, axis=0))

    metrics = {
        "luminance_std": float(luminance.std()),
        "rgb_std_mean": float(array.reshape(-1, 3).std(axis=0).mean()),
        "high_saturation_fraction": float((saturation_proxy > 0.45).mean()),
        "high_contrast_edge_fraction": float(((dx > 0.25).mean() + (dy > 0.25).mean()) / 2.0),
    }

    reasons = []
    if metrics["luminance_std"] < 0.02:
        reasons.append("near_uniform_image")
    if metrics["high_saturation_fraction"] > 0.15 and metrics["rgb_std_mean"] > 0.30:
        reasons.append("non_dermoscopic_color_pattern")
    if metrics["high_contrast_edge_fraction"] > 0.30:
        reasons.append("non_medical_texture_pattern")
    if metrics["high_contrast_edge_fraction"] > 0.03 and metrics["luminance_std"] > 0.45:
        reasons.append("checkerboard_or_artificial_pattern")

    return {
        "status": "review_required" if reasons else "plausible",
        "reasons": reasons,
        "metrics": metrics,
    }


def compute_prediction_status(probabilities, image_assessment=None):
    """Return deployment decision metadata for one 11-class probability vector."""
    probs = np.asarray(probabilities, dtype=np.float64).reshape(-1)
    if probs.size != len(CLASS_NAMES):
        raise ValueError(f"Expected {len(CLASS_NAMES)} probabilities, got {probs.size}")

    total = probs.sum()
    if total <= 0:
        raise ValueError("Probability vector must have positive mass")
    probs = probs / total

    top_index = int(np.argmax(probs))
    ordered_probs = np.sort(probs)
    top_class = CLASS_NAMES[top_index]
    top_prob = float(probs[top_index] * 100.0)
    second_prob = float(ordered_probs[-2] * 100.0)
    prediction_margin = float(top_prob - second_prob)
    malignant_prob = float(sum(probs[idx] for idx, name in enumerate(CLASS_NAMES) if name in MALIGNANT_CLASSES) * 100.0)
    benign_prob = float(100.0 - malignant_prob)
    risk_margin = float(abs(malignant_prob - benign_prob))
    entropy = float(-(probs * np.log(probs + 1e-12)).sum() / np.log(len(CLASS_NAMES)))

    uncertain_reasons = []
    if top_prob < UNCERTAIN_TOP_PROB_THRESHOLD:
        uncertain_reasons.append("top_class_probability_below_threshold")
    if entropy > UNCERTAIN_ENTROPY_THRESHOLD:
        uncertain_reasons.append("probability_entropy_above_threshold")
    if image_assessment and image_assessment.get("status") != "plausible":
        uncertain_reasons.extend(f"input_{reason}" for reason in image_assessment.get("reasons", []))

    review_reasons = []
    if risk_margin < UNCERTAIN_MARGIN_THRESHOLD:
        review_reasons.append("malignant_benign_margin_below_threshold")
    if prediction_margin < REVIEW_PREDICTION_MARGIN_THRESHOLD:
        review_reasons.append("top_two_prediction_margin_below_threshold")

    if uncertain_reasons:
        status = "uncertain"
        display = "Uncertain"
    elif review_reasons:
        status = "review_required"
        display = "Review Required"
    elif top_prob < 60.0:
        status = "low_confidence"
        display = "Low Confidence"
    else:
        status = "classifiable"
        display = "Classifiable"

    return {
        "status": status,
        "display": display,
        "top_class": top_class,
        "top_class_probability": top_prob,
        "second_class_probability": second_prob,
        "prediction_margin": prediction_margin,
        "malignant_probability": malignant_prob,
        "benign_probability": benign_prob,
        "malignant_benign_margin": risk_margin,
        "normalized_entropy": entropy,
        "uncertainty_reasons": uncertain_reasons,
        "review_reasons": review_reasons,
        "image_assessment": image_assessment,
        "thresholds": {
            "uncertain_top_class_probability": UNCERTAIN_TOP_PROB_THRESHOLD,
            "uncertain_malignant_benign_margin": UNCERTAIN_MARGIN_THRESHOLD,
            "uncertain_normalized_entropy": UNCERTAIN_ENTROPY_THRESHOLD,
            "review_prediction_margin": REVIEW_PREDICTION_MARGIN_THRESHOLD,
        },
    }


def build_swinv2_model_from_checkpoint(checkpoint):
    metadata = checkpoint.get("model_metadata", {})
    model = Milk10kSwinV2Classifier(
        num_classes=int(checkpoint.get("num_classes", len(CLASS_NAMES))),
        image_size=int(checkpoint.get("image_size", metadata.get("image_size", IMG_SIZE))),
        hidden_dim=int(metadata.get("hidden_dim", 512)),
        head_dropout=float(metadata.get("head_dropout", 0.35)),
        feature_dropout=float(metadata.get("feature_dropout", 0.1)),
        drop_path_rate=float(metadata.get("drop_path_rate", 0.25)),
    )
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    return model


def encode_location(location_str: str):
    location_str = str(location_str).lower().strip() if location_str else "other_unknown"

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
        "other_unknown": 4,
    }

    idx = mapping.get(location_str, 4)
    return F.one_hot(torch.tensor(idx), num_classes=5).float()
