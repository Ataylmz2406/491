import io
import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from contextlib import asynccontextmanager

# --- CONFIGURATION ---
MODEL_PATH = "model_weights.pth"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- MODEL DEFINITION ---
def get_model():
    # 1. Load EfficientNet-B0
    model = models.efficientnet_b0(weights=None)
    
    
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, 1)
    
    return model

# --- GLOBAL MODEL VARIABLE ---
model = None

# --- LIFESPAN MANAGER (Loads model on startup) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = get_model()
    
    if os.path.exists(MODEL_PATH):
        try:
            # Load weights
            state_dict = torch.load(MODEL_PATH, map_location=DEVICE)
            model.load_state_dict(state_dict)
            model.to(DEVICE)
            model.eval()
            print(f"✅ Success: Loaded EfficientNet-B0 weights from {MODEL_PATH}")
        except Exception as e:
            print(f"❌ Error loading weights: {e}")
            print("⚠️ WARNING: Server running with RANDOM weights for debugging only.")
    else:
        print(f"⚠️ WARNING: {MODEL_PATH} not found. Running with RANDOM weights.")
        model.to(DEVICE)
        model.eval()
        
    yield
    # Clean up (optional)
    model = None

# --- APP SETUP ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PREPROCESSING (Matches your Notebook) ---
# Resize 256 -> CenterCrop 224 -> Normalize (ImageNet stats)
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"message": "Skin Cancer Classification API (EfficientNet-B0) is running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # 1. Read and Transform Image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        input_tensor = transform(image).unsqueeze(0).to(DEVICE)

        # 2. Inference
        with torch.no_grad():
            output = model(input_tensor)
            # Your notebook used BCEWithLogitsLoss, so we apply Sigmoid to get probability
            probability = torch.sigmoid(output).item()

        # 3. Class Logic (From your notebook)
        # Class 1 (>= 0.5) = Melanocytic (Risk)
        # Class 0 (< 0.5)  = Others
        
        if probability >= 0.5:
            predicted_label = "Melanocytic (Risk)"
            confidence_score = probability * 100
        else:
            predicted_label = "Other (Benign)"
            confidence_score = (1 - probability) * 100

        return {
            "class": predicted_label,
            "confidence": f"{confidence_score:.2f}%",
            "raw_probability": probability 
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during prediction")