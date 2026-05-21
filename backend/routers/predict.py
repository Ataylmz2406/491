import asyncio
import io
import logging

import numpy as np
import torch
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from PIL import Image, UnidentifiedImageError
from slowapi import Limiter
from slowapi.util import get_remote_address

import state
from config import (
    DEVICE,
    PREDICT_ALLOWED_IMAGE_MIME_TYPES,
    PREDICT_MAX_IMAGE_BYTES,
)
from model_utils import (
    CLASS_NAMES,
    IMG_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    MALIGNANT_CLASSES,
    MODEL_ARCHITECTURE,
    MODEL_CHECKPOINT_NAME,
    MODEL_DISPLAY_NAME,
    MODEL_INPUT_MODALITY,
    MODEL_TRANSFER_SOURCE,
    assess_dermoscopic_image_plausibility,
    compute_prediction_status,
    encode_location,
)

router = APIRouter(tags=["predict"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger("suderm")


def interpret_prediction(probs: torch.Tensor) -> tuple[str, float]:
    probs_np = probs.detach().cpu().numpy()[0]
    malignant_sum = sum(probs_np[i] for i, name in enumerate(CLASS_NAMES) if name in MALIGNANT_CLASSES)
    benign_sum = sum(probs_np[i] for i, name in enumerate(CLASS_NAMES) if name not in MALIGNANT_CLASSES)
    top_class_name = CLASS_NAMES[np.argmax(probs_np)]
    if top_class_name in MALIGNANT_CLASSES or malignant_sum > benign_sum:
        return "Malignant (Risk)", malignant_sum * 100
    return "Benign", benign_sum * 100


def check_zoom_level(img: Image.Image) -> str:
    w, h = img.size
    aspect = max(w, h) / min(w, h)
    if aspect < 1.1 and max(w, h) <= 1024:
        return "Warning: Clinical image appears to be pre-cropped or square. Ensure it is a macro-shot (TBP)."
    return "OK"


async def _read_prediction_image(upload: UploadFile, label: str) -> Image.Image:
    content_type = (upload.content_type or "").lower()
    if content_type not in PREDICT_ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"{label} must be a supported image type: {', '.join(sorted(PREDICT_ALLOWED_IMAGE_MIME_TYPES))}",
        )
    image_bytes = await upload.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail=f"{label} is empty")
    if len(image_bytes) > PREDICT_MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{label} exceeds maximum size ({PREDICT_MAX_IMAGE_BYTES // (1024*1024):.0f} MB)",
        )
    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail=f"{label} could not be decoded as an image")


def _run_inference(dermoscopic_images: list) -> np.ndarray:
    prediction_tensors = []
    with torch.no_grad():
        for derm_img in dermoscopic_images:
            derm_tensor = state.transform(derm_img).unsqueeze(0).to(DEVICE)
            logits = state.model(derm_tensor)
            prediction_tensors.append(torch.softmax(logits, dim=1))
            del derm_tensor
    probs = torch.stack(prediction_tensors, dim=0).mean(dim=0)
    return probs[0].cpu().numpy()


@router.post("/predict")
@limiter.limit("10/minute")
async def predict(
    request: Request,
    dermoscopic_image: UploadFile = File(...),
    dermoscopic_image_2: UploadFile = File(None),
    dermoscopic_image_3: UploadFile = File(None),
    dermoscopic_image_4: UploadFile = File(None),
    clinical_image: UploadFile = File(None),
    lesion_location: str = Form(None),
    diagnosis: str = Form(None),
):
    location_vector = encode_location(lesion_location)
    location_vec_list = location_vector.tolist()

    try:
        uploads = [dermoscopic_image, dermoscopic_image_2, dermoscopic_image_3, dermoscopic_image_4]
        dermoscopic_images = [
            await _read_prediction_image(u, f"Dermoscopic image {i}")
            for i, u in enumerate(uploads, start=1)
            if u is not None
        ]
        if not dermoscopic_images:
            raise HTTPException(status_code=400, detail="At least one dermoscopic image is required")

        logger.info("Analysis request received with %d dermoscopic image(s)", len(dermoscopic_images))
        image_assessments = [assess_dermoscopic_image_plausibility(img) for img in dermoscopic_images]

        zoom_warning = "N/A"
        if clinical_image:
            clin_img = await _read_prediction_image(clinical_image, "Clinical image")
            zoom_warning = check_zoom_level(clin_img)

        async with state.inference_semaphore:
            probs_np = await asyncio.to_thread(_run_inference, dermoscopic_images)
        probs = torch.from_numpy(probs_np).unsqueeze(0)

        pred_label, conf_score = interpret_prediction(probs)
        review_assessments = [a for a in image_assessments if a["status"] != "plausible"]
        deployment_status = compute_prediction_status(
            probs_np,
            image_assessment=review_assessments[0] if review_assessments else None,
        )

        if DEVICE.type == "mps":
            torch.mps.empty_cache()

        return {
            "prediction": pred_label,
            "confidence_score": float(conf_score),
            "predicted_class": CLASS_NAMES[probs.argmax().item()],
            "risk_category": pred_label,
            "deployment_status": deployment_status["status"],
            "confidence_status": deployment_status["display"],
            "model": {
                "architecture": MODEL_ARCHITECTURE,
                "name": MODEL_DISPLAY_NAME,
                "checkpoint": MODEL_CHECKPOINT_NAME,
                "transfer_source": MODEL_TRANSFER_SOURCE,
                "input_modality": MODEL_INPUT_MODALITY,
                "image_size": IMG_SIZE,
                "class_order": CLASS_NAMES,
                "preprocessing": {
                    "resize": f"{IMG_SIZE}x{IMG_SIZE}",
                    "interpolation": "bicubic",
                    "crop": "none",
                    "normalization_mean": IMAGENET_MEAN,
                    "normalization_std": IMAGENET_STD,
                },
            },
            "metadata": {
                "location": lesion_location,
                "diagnosis_gt": diagnosis,
                "location_vector": location_vec_list,
                "zoom_check": zoom_warning,
                "dermoscopic_image_count": len(dermoscopic_images),
                "clinical_image_received": clinical_image is not None,
                "clinical_image_used_for_inference": False,
                "dermoscopic_image_assessments": image_assessments,
            },
            "details": {
                "top_class": CLASS_NAMES[probs.argmax().item()],
                "top_prob": float(probs.max().item() * 100),
                "deployment_status": deployment_status,
                "all_predictions": [
                    {"class": name, "prob": float(prob * 100)}
                    for name, prob in zip(CLASS_NAMES, probs_np)
                ],
            },
        }

    except HTTPException:
        if DEVICE.type == "mps":
            torch.mps.empty_cache()
        raise
    except Exception as e:
        if DEVICE.type == "mps":
            torch.mps.empty_cache()
        logger.exception("Prediction error: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Analysis service could not process the image. Please try again.",
        )
