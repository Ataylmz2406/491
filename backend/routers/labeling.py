import os
import base64
import logging

from fastapi import APIRouter, Header, HTTPException
from config import MIL10K_DATASET_PATH
from database import get_db_connection, utc_now_iso
from dependencies import verify_doctor_token, build_requester_identity
from model_utils import CLASS_NAMES
from models.schemas import ImageLabelCreate, ImageLabelOut, MilImageInfo

router = APIRouter(prefix="/mil10k", tags=["labeling"])
logger = logging.getLogger("suderm")

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".webp"}
_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".webp": "image/webp",
}


def get_all_mil10k_images() -> list[MilImageInfo]:
    images: list[MilImageInfo] = []
    if not os.path.exists(MIL10K_DATASET_PATH):
        logger.warning("Mil10K dataset path not found: %s", MIL10K_DATASET_PATH)
        return images
    try:
        for folder in os.listdir(MIL10K_DATASET_PATH):
            folder_path = os.path.join(MIL10K_DATASET_PATH, folder)
            if not os.path.isdir(folder_path):
                continue
            for filename in os.listdir(folder_path):
                file_path = os.path.join(folder_path, filename)
                if not os.path.isfile(file_path):
                    continue
                if not any(filename.lower().endswith(ext) for ext in _IMAGE_EXTENSIONS):
                    continue
                relative_path = os.path.join(folder, filename).replace("\\", "/")
                images.append(MilImageInfo(folder=folder, filename=filename, path=relative_path))
    except Exception as e:
        logger.error("Error scanning Mil10K dataset: %s", e)
    return images


@router.get("/images", response_model=list[MilImageInfo])
def get_mil10k_images(authorization: str = Header(default="")):
    verify_doctor_token(authorization)
    return get_all_mil10k_images()


@router.get("/image-data/{folder}/{filename}")
async def get_mil10k_image_data(folder: str, filename: str, authorization: str = Header(default="")):
    verify_doctor_token(authorization)
    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid image path")

    file_path = os.path.join(MIL10K_DATASET_PATH, folder, filename)
    real_path = os.path.abspath(file_path)
    real_dataset_path = os.path.abspath(MIL10K_DATASET_PATH)

    if not real_path.startswith(real_dataset_path):
        raise HTTPException(status_code=400, detail="Invalid image path")
    if not os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        with open(real_path, "rb") as f:
            image_bytes = f.read()
        ext = os.path.splitext(filename)[1].lower()
        mime_type = _MIME_MAP.get(ext, "image/jpeg")
        b64_data = base64.b64encode(image_bytes).decode("utf-8")
        return {"data": b64_data, "mime_type": mime_type, "folder": folder, "filename": filename}
    except Exception as e:
        logger.error("Error reading image: %s", e)
        raise HTTPException(status_code=500, detail="Could not read image")


@router.post("/labels", response_model=ImageLabelOut)
def create_mil10k_label(
    payload: ImageLabelCreate,
    authorization: str = Header(default=""),
):
    token_row = verify_doctor_token(authorization)
    doctor_name = (token_row["display_name"] or "").strip()
    doctor_identity = build_requester_identity(token_row)

    conn = get_db_connection()
    try:
        user = conn.execute(
            "SELECT hospital FROM users WHERE subject = ?", (token_row["subject"],)
        ).fetchone()
        doctor_affiliation = (user["hospital"] or "") if user else ""
    finally:
        conn.close()

    if payload.classification not in CLASS_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid classification. Allowed: {', '.join(CLASS_NAMES)}",
        )
    if not (1 <= payload.confidence_score <= 5):
        raise HTTPException(status_code=400, detail="Confidence score must be between 1 and 5")

    conn = get_db_connection()
    try:
        now = utc_now_iso()
        existing = conn.execute(
            "SELECT id FROM mil10k_labels WHERE image_path = ? AND labeled_by_identity = ?",
            (payload.image_path, doctor_identity),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE mil10k_labels
                SET image_folder = ?, image_filename = ?, classification = ?,
                    confidence_score = ?, doctor_name = ?, doctor_affiliation = ?, labeled_at = ?
                WHERE id = ?
                """,
                (
                    payload.image_folder, payload.image_filename, payload.classification,
                    payload.confidence_score, doctor_name, doctor_affiliation, now, existing["id"],
                ),
            )
            label_id = existing["id"]
        else:
            cursor = conn.execute(
                """
                INSERT INTO mil10k_labels
                  (image_path, image_folder, image_filename, classification,
                   confidence_score, labeled_by_identity, doctor_name, doctor_affiliation, labeled_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                (
                    payload.image_path, payload.image_folder, payload.image_filename,
                    payload.classification, payload.confidence_score, doctor_identity,
                    doctor_name, doctor_affiliation, now,
                ),
            )
            label_id = cursor.fetchone()["id"]

        conn.commit()
        row = conn.execute(
            """
            SELECT id, image_path, image_folder, image_filename, classification,
                   confidence_score, doctor_name, doctor_affiliation, labeled_at
            FROM mil10k_labels WHERE id = ?
            """,
            (label_id,),
        ).fetchone()
        return ImageLabelOut(
            id=row["id"],
            image_path=row["image_path"],
            image_folder=row["image_folder"],
            image_filename=row["image_filename"],
            classification=row["classification"],
            confidence_score=row["confidence_score"],
            doctor_name=row["doctor_name"] or "",
            doctor_affiliation=row["doctor_affiliation"],
            labeled_at=row["labeled_at"],
        )
    except Exception as e:
        logger.error("Error creating label: %s", e)
        raise HTTPException(status_code=500, detail="Could not save label")
    finally:
        conn.close()


@router.get("/labels/{folder}/{filename}")
def get_mil10k_label(folder: str, filename: str, authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    doctor_identity = build_requester_identity(token_row)

    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid image path")

    image_path = f"{folder}/{filename}"
    conn = get_db_connection()
    try:
        label = conn.execute(
            "SELECT * FROM mil10k_labels WHERE image_path = ? AND labeled_by_identity = ?",
            (image_path, doctor_identity),
        ).fetchone()
        if not label:
            return None
        return ImageLabelOut(
            id=label["id"],
            image_path=label["image_path"],
            image_folder=label["image_folder"],
            image_filename=label["image_filename"],
            classification=label["classification"],
            confidence_score=label["confidence_score"],
            doctor_name=label["doctor_name"],
            doctor_affiliation=label["doctor_affiliation"],
            labeled_at=label["labeled_at"],
        )
    except Exception as e:
        logger.error("Error getting label: %s", e)
        raise HTTPException(status_code=500, detail="Could not get label")
    finally:
        conn.close()


@router.get("/labels-stats")
def get_mil10k_labels_stats(authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    doctor_identity = build_requester_identity(token_row)
    conn = get_db_connection()
    try:
        total_images = len(get_all_mil10k_images())
        my_count = conn.execute(
            "SELECT COUNT(DISTINCT image_path) as count FROM mil10k_labels WHERE labeled_by_identity = ?",
            (doctor_identity,),
        ).fetchone()["count"]
        my_dist = {
            row["classification"]: row["count"]
            for row in conn.execute(
                "SELECT classification, COUNT(*) as count FROM mil10k_labels WHERE labeled_by_identity = ? GROUP BY classification ORDER BY count DESC",
                (doctor_identity,),
            ).fetchall()
        }
        global_count = conn.execute(
            "SELECT COUNT(DISTINCT image_path) as count FROM mil10k_labels"
        ).fetchone()["count"]
        global_dist = {
            row["classification"]: row["count"]
            for row in conn.execute(
                "SELECT classification, COUNT(*) as count FROM mil10k_labels GROUP BY classification ORDER BY count DESC"
            ).fetchall()
        }
        return {
            "total_images": total_images,
            "labeled_count": my_count,
            "unlabeled_count": max(total_images - my_count, 0),
            "completion_percentage": round((my_count / total_images * 100) if total_images > 0 else 0, 2),
            "distribution": my_dist,
            "global_labeled_count": global_count,
            "global_unlabeled_count": max(total_images - global_count, 0),
            "global_completion_percentage": round((global_count / total_images * 100) if total_images > 0 else 0, 2),
            "global_distribution": global_dist,
        }
    except Exception as e:
        logger.error("Error getting stats: %s", e)
        raise HTTPException(status_code=500, detail="Could not get stats")
    finally:
        conn.close()
