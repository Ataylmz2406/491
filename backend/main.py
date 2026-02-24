import io
import os
import uuid
import torch
import numpy as np
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from contextlib import asynccontextmanager
from model_utils import (
    DualHierarchicalModel, 
    get_inference_transform, 
    stitch_predictions, 
    CLASS_NAMES, 
    IMG_SIZE,
    encode_location,
    IMAGENET_MEAN,
    IMAGENET_STD
)

# --- CONFIGURATION ---
MODEL_WEIGHTS = "Weights_DualEffV2_Funnel_20251129_1830.pth"

# Prefer MPS (Apple Silicon GPU) over CPU on macOS
if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
elif torch.backends.mps.is_available():
    DEVICE = torch.device("mps")
else:
    DEVICE = torch.device("cpu")

HEATMAP_DIR = "static/heatmaps"

# --- GLOBAL VARIABLES ---
model = None
transform = None

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, transform
    
    # 1. Create heatmap directory
    os.makedirs(HEATMAP_DIR, exist_ok=True)
    
    # 2. Initialize Model
    print(f"Initializing model on {DEVICE}...")
    model = DualHierarchicalModel(arch='tf_efficientnetv2_xl.in21k_ft_in1k', emb_dim=512, dropout=0.2)
    
    # 3. Load Weights
    if os.path.exists(MODEL_WEIGHTS):
        print(f"Loading weights from {MODEL_WEIGHTS}...")
        try:
            state_dict = torch.load(MODEL_WEIGHTS, map_location=DEVICE)
            model.load_state_dict(state_dict, strict=False) 
            print("✅ Weights loaded successfully.")
        except Exception as e:
            print(f"❌ Error loading weights: {e}")
            print("⚠️ Server starting with RANDOM weights (for testing only).")
    else:
        print(f"⚠️ Weights file {MODEL_WEIGHTS} not found. Starting with RANDOM weights.")
    
    model.to(DEVICE)
    model.eval()
    
    # 4. Initialize Transform
    transform = get_inference_transform(IMG_SIZE)
    
    yield
    
    # Cleanup
    model = None
    transform = None

app = FastAPI(lifespan=lifespan, title="SUDerm API", version="1.0.0")

# --- STATIC FILES (for Grad-CAM heatmaps) ---
app.mount("/heatmap", StaticFiles(directory=HEATMAP_DIR), name="heatmaps")

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UTILITY: MALIGNANCY CHECK ---
MALIGNANT_CLASSES = {'MEL', 'BCC', 'SCCKA', 'AKIEC', 'MAL_OTH'}

def interpret_prediction(probs):
    """
    probs: tensor of shape (1, 11)
    Returns: (label_str, confidence_score_percentage)
    """
    probs = probs.detach().cpu().numpy()[0]
    
    malignant_sum = 0.0
    benign_sum = 0.0
    
    for i, name in enumerate(CLASS_NAMES):
        if name in MALIGNANT_CLASSES:
            malignant_sum += probs[i]
        else:
            benign_sum += probs[i]
            
    # Return as percentage (0-100)
    if malignant_sum > benign_sum:
        return "Malignant (Risk)", malignant_sum * 100
    else:
        return "Benign", benign_sum * 100

# --- ZOOM CHECK (Fixed Threshold) ---
def check_zoom_level(img: Image.Image):
    """
    Heuristic check for Clinical (TBP) vs Dermoscopic zoom.
    FIXED: Now catches standard dermoscopic sizes up to 1024px.
    """
    w, h = img.size
    aspect = max(w, h) / min(w, h)
    
    # If image is nearly square (aspect < 1.1) AND dimension <= 1024px,
    # it's likely a cropped dermoscopic image, NOT a raw clinical photo.
    is_suspicious_clinical = (aspect < 1.1 and max(w, h) <= 1024)
    
    if is_suspicious_clinical:
        return "Warning: Clinical image appears to be pre-cropped or square. Ensure it is a macro-shot (TBP)."
    return "OK"



# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"message": "SUDerm - Dual-Branch Skin Lesion Analysis API (Sabanci University)"}

@app.post("/predict")
async def predict(
    dermoscopic_image: UploadFile = File(...),
    clinical_image: UploadFile = File(None),
    lesion_location: str = Form(None),
    diagnosis: str = Form(None)
):
    if not dermoscopic_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Dermoscopic file must be an image")
    
    if clinical_image and not clinical_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Clinical file must be an image")
        
    print(f"--- Analysis Request ---")
    print(f"Location: {lesion_location}, Dx: {diagnosis}")
    
    # Smart Mapping for Location
    location_vector = encode_location(lesion_location)
    location_vec_list = location_vector.tolist()

    try:
        # 1. Process Dermoscopic Image (Required)
        derm_bytes = await dermoscopic_image.read()
        derm_img = Image.open(io.BytesIO(derm_bytes)).convert("RGB")
        derm_tensor = transform(derm_img).unsqueeze(0).to(DEVICE)
        
        # 2. Process Clinical Image (Optional - Fallback to Zero)
        zoom_warning = "N/A"
        if clinical_image:
            clin_bytes = await clinical_image.read()
            clin_img = Image.open(io.BytesIO(clin_bytes)).convert("RGB")
            zoom_warning = check_zoom_level(clin_img)
            clin_tensor = transform(clin_img).unsqueeze(0).to(DEVICE)
        else:
            clin_tensor = torch.zeros((1, 3, IMG_SIZE, IMG_SIZE), device=DEVICE)
            print("ℹ️ Clinical image missing. Using zero-tensor fallback.")

        # 3. Fast Inference (prediction only, no Grad-CAM)
        with torch.no_grad():
            l_grp, l_mel, l_oth = model(clin_tensor, derm_tensor)
            probs = stitch_predictions(l_grp, l_mel, l_oth)
        
        # 🔍 DEBUG: Log raw probabilities
        probs_np = probs[0].cpu().numpy()
        print("\n=== RAW PROBABILITIES ===")
        for i, (name, prob) in enumerate(zip(CLASS_NAMES, probs_np)):
            print(f"{name:10s}: {prob:.4f} ({prob*100:.2f}%)")
        print(f"Sum: {probs_np.sum():.4f}")
        print("========================\n")
            
        # 4. Interpret Result
        pred_label, conf_score = interpret_prediction(probs)

        # 5. Memory cleanup for MPS
        del clin_tensor, derm_tensor
        if DEVICE.type == 'mps':
            torch.mps.empty_cache()

        return {
            "prediction": pred_label,
            "confidence_score": float(conf_score),
            "metadata": {
                "location": lesion_location,
                "diagnosis_gt": diagnosis,
                "location_vector": location_vec_list,
                "zoom_check": zoom_warning
            },
            "details": {
                "top_class": CLASS_NAMES[probs.argmax().item()],
                "top_prob": float(probs.max().item() * 100)
            }
        }

    except Exception as e:
        # Cleanup on error too
        if DEVICE.type == 'mps':
            torch.mps.empty_cache()
        print(f"Prediction Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))