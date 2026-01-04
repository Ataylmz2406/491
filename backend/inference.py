import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import io

# --- CONFIGURATION ---
# Since your weights are size [1, 1280], we must use num_classes=1
NUM_CLASSES = 1 

def get_model():
    model = models.efficientnet_b0(weights=None)
    # Match the binary head from your training
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, NUM_CLASSES) 
    return model

def get_prediction(model, image_bytes, device="cpu"):
    # Preprocessing
    my_transforms = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = my_transforms(image).unsqueeze(0).to(device)
    
    model.eval()
    with torch.no_grad():
        outputs = model(tensor)
        # Binary = Sigmoid Activation
        prob = torch.sigmoid(outputs).item()
        
    # Interpretation
    if prob >= 0.5:
        label = "Melanocytic (High Risk)"
        # Note: Melanoma (MEL) and Nevus (NV) are in this group
        confidence = prob 
    else:
        label = "Other (Benign / Non-Melanocytic)"
        # Note: BCC, Merkel Cell, etc. are technically in this group 
        # because the notebook grouped everything not MEL/NV as '0'.
        confidence = 1 - prob
        
    return label, confidence