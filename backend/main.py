import io
import os
import uuid
import sqlite3
import torch
import numpy as np
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
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
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "suderm.db")

# Prefer CUDA > MPS (Apple Silicon) > CPU
if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    try:
        if torch.backends.mps.is_available():
            DEVICE = torch.device("mps")
        else:
            DEVICE = torch.device("cpu")
    except AttributeError:
        # torch.backends.mps not available on older PyTorch / Windows
        DEVICE = torch.device("cpu")

HEATMAP_DIR = "static/heatmaps"

# --- GLOBAL VARIABLES ---
model = None
transform = None


# --- DATABASE ---
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnoses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                diagnosis TEXT NOT NULL,
                confidence REAL NOT NULL,
                location TEXT NOT NULL,
                status TEXT NOT NULL,
                patient_id TEXT,
                age_group TEXT,
                sex TEXT,
                skin_tone TEXT
            )
            """
        )
        conn.commit()
    finally:
        conn.close()
    ensure_schema_columns()


class DiagnosisIn(BaseModel):
    date: str
    diagnosis: str
    confidence: float
    location: str
    status: str
    patient_id: str | None = None
    age_group: str | None = None
    sex: str | None = None
    skin_tone: str | None = None


class DiagnosisOut(DiagnosisIn):
    id: int


def ensure_schema_columns():
    """Adds newly introduced optional columns for older SQLite files."""
    conn = get_db_connection()
    try:
        columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(diagnoses)").fetchall()
        }
        migration_columns = {
            "patient_id": "TEXT",
            "age_group": "TEXT",
            "sex": "TEXT",
            "skin_tone": "TEXT",
        }
        for column_name, column_type in migration_columns.items():
            if column_name not in columns:
                conn.execute(
                    f"ALTER TABLE diagnoses ADD COLUMN {column_name} {column_type}"
                )
        conn.commit()
    finally:
        conn.close()

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, transform
    
    # 1. Create heatmap directory
    os.makedirs(HEATMAP_DIR, exist_ok=True)

    # 1.1 Initialize SQLite database
    init_db()
    
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
os.makedirs(HEATMAP_DIR, exist_ok=True)
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
            
    top_class_idx = np.argmax(probs)
    top_class_name = CLASS_NAMES[top_class_idx]
            
    # Return as percentage (0-100)
    if (top_class_name in MALIGNANT_CLASSES) or (malignant_sum > benign_sum):
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


@app.get("/history", response_model=list[DiagnosisOut])
def get_history(patient_id: str | None = None):
    conn = get_db_connection()
    try:
        if patient_id:
            rows = conn.execute(
                """
                SELECT id, date, diagnosis, confidence, location, status,
                       patient_id, age_group, sex, skin_tone
                FROM diagnoses
                WHERE patient_id = ?
                ORDER BY datetime(date) DESC, id DESC
                """,
                (patient_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, date, diagnosis, confidence, location, status,
                       patient_id, age_group, sex, skin_tone
                FROM diagnoses
                ORDER BY datetime(date) DESC, id DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.post("/history", response_model=DiagnosisOut)
def create_history_item(payload: DiagnosisIn):
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            """
            INSERT INTO diagnoses (
                date, diagnosis, confidence, location, status,
                patient_id, age_group, sex, skin_tone
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.date,
                payload.diagnosis,
                payload.confidence,
                payload.location,
                payload.status,
                payload.patient_id,
                payload.age_group,
                payload.sex,
                payload.skin_tone,
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, date, diagnosis, confidence, location, status,
                   patient_id, age_group, sex, skin_tone
            FROM diagnoses
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


@app.delete("/history/{diagnosis_id}")
def delete_history_item(diagnosis_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM diagnoses WHERE id = ?", (diagnosis_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
        return {"ok": True}
    finally:
        conn.close()


@app.delete("/history")
def delete_all_history():
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM diagnoses")
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

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
                "top_prob": float(probs.max().item() * 100),
                "all_predictions": [
                    {"class": name, "prob": float(prob * 100)}
                    for name, prob in zip(CLASS_NAMES, probs_np)
                ]
            }
        }

    except Exception as e:
        # Cleanup on error too
        if DEVICE.type == 'mps':
            torch.mps.empty_cache()
        print(f"Prediction Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))