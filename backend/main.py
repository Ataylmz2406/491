import io
import os
import torch
import numpy as np
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from database import init_db
from models import (
    DiagnosisIn, DiagnosisOut,
    SecondOpinionPostCreate, SecondOpinionPostUpdate, SecondOpinionCommentCreate,
    SecondOpinionPostOut, SecondOpinionCommentOut,
    AuthLoginRequest, AuthLoginResponse, AuthMeResponse,
    SECOND_OPINION_POST_MAX_REQUEST_BYTES,
)
import repositories.auth as auth_repo
import repositories.diagnoses as diagnoses_repo
import repositories.second_opinion as second_opinion_repo
from model_utils import (
    DualHierarchicalModel,
    get_inference_transform,
    stitch_predictions,
    CLASS_NAMES,
    IMG_SIZE,
    encode_location,
)

# --- CONFIGURATION ---
MODEL_WEIGHTS = "Weights_DualEffV2_Funnel_20251129_1830.pth"
HEATMAP_DIR = "static/heatmaps"

if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    try:
        DEVICE = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
    except AttributeError:
        DEVICE = torch.device("cpu")

model = None
transform = None

MALIGNANT_CLASSES = {"MEL", "BCC", "SCCKA", "AKIEC", "MAL_OTH"}


def interpret_prediction(probs):
    probs = probs.detach().cpu().numpy()[0]
    malignant_sum = sum(probs[i] for i, name in enumerate(CLASS_NAMES) if name in MALIGNANT_CLASSES)
    benign_sum = sum(probs[i] for i, name in enumerate(CLASS_NAMES) if name not in MALIGNANT_CLASSES)
    top_class_name = CLASS_NAMES[np.argmax(probs)]
    if top_class_name in MALIGNANT_CLASSES or malignant_sum > benign_sum:
        return "Malignant (Risk)", malignant_sum * 100
    return "Benign", benign_sum * 100


def check_zoom_level(img: Image.Image) -> str:
    w, h = img.size
    aspect = max(w, h) / min(w, h)
    if aspect < 1.1 and max(w, h) <= 1024:
        return "Warning: Clinical image appears to be pre-cropped or square. Ensure it is a macro-shot (TBP)."
    return "OK"


# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, transform

    os.makedirs(HEATMAP_DIR, exist_ok=True)
    init_db()

    print(f"Initializing model on {DEVICE}...")
    model = DualHierarchicalModel(arch="tf_efficientnetv2_xl.in21k_ft_in1k", emb_dim=512, dropout=0.2)

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
    transform = get_inference_transform(IMG_SIZE)

    yield

    model = None
    transform = None


app = FastAPI(lifespan=lifespan, title="SUDerm API", version="1.0.0")


@app.middleware("http")
async def enforce_second_opinion_request_limit(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/second-opinion/posts":
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                content_length_value = int(content_length)
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"})
            if content_length_value > SECOND_OPINION_POST_MAX_REQUEST_BYTES:
                max_mb = SECOND_OPINION_POST_MAX_REQUEST_BYTES / (1024 * 1024)
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request payload too large (max {max_mb:.1f} MB)"},
                )
    return await call_next(request)


os.makedirs(HEATMAP_DIR, exist_ok=True)
app.mount("/heatmap", StaticFiles(directory=HEATMAP_DIR), name="heatmaps")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- AUTH ---
@app.get("/")
def read_root():
    return {"message": "SUDerm - Dual-Branch Skin Lesion Analysis API (Sabanci University)"}


@app.post("/auth/login", response_model=AuthLoginResponse)
def auth_login(payload: AuthLoginRequest):
    return auth_repo.login(payload)


@app.get("/auth/me", response_model=AuthMeResponse)
def auth_me(authorization: str = Header(default="")):
    token_row = auth_repo.verify_token(authorization)
    return AuthMeResponse(
        user_type=token_row["user_type"],
        display_name=token_row["display_name"],
        expires_at=token_row["expires_at"],
    )


@app.post("/auth/logout")
def auth_logout(authorization: str = Header(default="")):
    auth_repo.revoke_token(authorization)
    return {"ok": True}


# --- DIAGNOSES ---
@app.get("/history", response_model=list[DiagnosisOut])
def get_history(patient_id: str | None = None):
    return diagnoses_repo.get_history(patient_id)


@app.post("/history", response_model=DiagnosisOut)
def create_history_item(payload: DiagnosisIn):
    return diagnoses_repo.create_diagnosis(payload)


@app.delete("/history/{diagnosis_id}")
def delete_history_item(diagnosis_id: int):
    diagnoses_repo.delete_diagnosis(diagnosis_id)
    return {"ok": True}


@app.delete("/history")
def delete_all_history():
    diagnoses_repo.delete_all_diagnoses()
    return {"ok": True}


# --- SECOND OPINION ---
@app.get("/second-opinion/posts", response_model=list[SecondOpinionPostOut])
def list_second_opinion_posts(
    status: str | None = None,
    doctor_name: str | None = None,
    patient_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return second_opinion_repo.list_posts(status, doctor_name, patient_id, limit, offset)


@app.get("/second-opinion/posts/{post_id}", response_model=SecondOpinionPostOut)
def get_second_opinion_post(post_id: int):
    return second_opinion_repo.get_post(post_id)


@app.post("/second-opinion/posts", response_model=SecondOpinionPostOut)
def create_second_opinion_post(
    payload: SecondOpinionPostCreate,
    authorization: str = Header(default=""),
):
    token_row = auth_repo.verify_token(authorization)
    return second_opinion_repo.create_post(payload, token_row)


@app.post("/second-opinion/posts/{post_id}/comments", response_model=SecondOpinionCommentOut)
def create_second_opinion_comment(
    post_id: int,
    payload: SecondOpinionCommentCreate,
    authorization: str = Header(default=""),
):
    token_row = auth_repo.verify_token(authorization)
    return second_opinion_repo.create_comment(post_id, payload, token_row)


@app.patch("/second-opinion/posts/{post_id}", response_model=SecondOpinionPostOut)
def update_second_opinion_post(
    post_id: int,
    payload: SecondOpinionPostUpdate,
    authorization: str = Header(default=""),
):
    token_row = auth_repo.verify_token(authorization)
    return second_opinion_repo.update_post(post_id, payload, token_row)


@app.delete("/second-opinion/posts/{post_id}")
def delete_second_opinion_post(post_id: int, authorization: str = Header(default="")):
    token_row = auth_repo.verify_token(authorization)
    second_opinion_repo.delete_post(post_id, token_row)
    return {"ok": True}


# --- ML INFERENCE ---
@app.post("/predict")
async def predict(
    dermoscopic_image: UploadFile = File(...),
    clinical_image: UploadFile = File(None),
    lesion_location: str = Form(None),
    diagnosis: str = Form(None),
):
    if not dermoscopic_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Dermoscopic file must be an image")
    if clinical_image and not clinical_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Clinical file must be an image")

    print(f"--- Analysis Request ---")
    print(f"Location: {lesion_location}, Dx: {diagnosis}")

    location_vector = encode_location(lesion_location)
    location_vec_list = location_vector.tolist()

    try:
        derm_bytes = await dermoscopic_image.read()
        derm_img = Image.open(io.BytesIO(derm_bytes)).convert("RGB")
        derm_tensor = transform(derm_img).unsqueeze(0).to(DEVICE)

        zoom_warning = "N/A"
        if clinical_image:
            clin_bytes = await clinical_image.read()
            clin_img = Image.open(io.BytesIO(clin_bytes)).convert("RGB")
            zoom_warning = check_zoom_level(clin_img)
            clin_tensor = transform(clin_img).unsqueeze(0).to(DEVICE)
        else:
            clin_tensor = torch.zeros((1, 3, IMG_SIZE, IMG_SIZE), device=DEVICE)
            print("ℹ️ Clinical image missing. Using zero-tensor fallback.")

        with torch.no_grad():
            l_grp, l_mel, l_oth = model(clin_tensor, derm_tensor)
            probs = stitch_predictions(l_grp, l_mel, l_oth)

        probs_np = probs[0].cpu().numpy()
        print("\n=== RAW PROBABILITIES ===")
        for name, prob in zip(CLASS_NAMES, probs_np):
            print(f"{name:10s}: {prob:.4f} ({prob*100:.2f}%)")
        print(f"Sum: {probs_np.sum():.4f}")
        print("========================\n")

        pred_label, conf_score = interpret_prediction(probs)

        del clin_tensor, derm_tensor
        if DEVICE.type == "mps":
            torch.mps.empty_cache()

        return {
            "prediction": pred_label,
            "confidence_score": float(conf_score),
            "metadata": {
                "location": lesion_location,
                "diagnosis_gt": diagnosis,
                "location_vector": location_vec_list,
                "zoom_check": zoom_warning,
            },
            "details": {
                "top_class": CLASS_NAMES[probs.argmax().item()],
                "top_prob": float(probs.max().item() * 100),
                "all_predictions": [
                    {"class": name, "prob": float(prob * 100)}
                    for name, prob in zip(CLASS_NAMES, probs_np)
                ],
            },
        }

    except Exception as e:
        if DEVICE.type == "mps":
            torch.mps.empty_cache()
        print(f"Prediction Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
