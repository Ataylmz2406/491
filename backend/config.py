import os
import torch
from model_utils import MODEL_CHECKPOINT_NAME

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_WEIGHTS = os.path.abspath(os.path.join(BASE_DIR, MODEL_CHECKPOINT_NAME))
MIL10K_DATASET_PATH = os.path.join(BASE_DIR, "..", "Mil10K images")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://suderm:suderm_pass@localhost:5432/sudermdb",
)

PREDICT_ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
PREDICT_MAX_IMAGE_BYTES = 8 * 1024 * 1024

PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256"
PASSWORD_HASH_ITERATIONS = 310_000

if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    try:
        if torch.backends.mps.is_available():
            DEVICE = torch.device("mps")
        else:
            DEVICE = torch.device("cpu")
    except AttributeError:
        DEVICE = torch.device("cpu")

HEATMAP_DIR = "static/heatmaps"
INFERENCE_MAX_CONCURRENCY = int(os.environ.get("SUDERM_INFERENCE_MAX_CONCURRENCY", "2"))

SECOND_OPINION_ALLOWED_STATUSES = {"open", "resolved", "archived", "draft"}
SECOND_OPINION_MAX_IMAGES = 12
SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
SECOND_OPINION_MAX_IMAGE_BYTES = 2 * 1024 * 1024
SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024
SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS = 3_000_000
SECOND_OPINION_POST_MAX_REQUEST_BYTES = 12 * 1024 * 1024
SECOND_OPINION_MAX_QUESTION_LEN = 4000
SECOND_OPINION_MAX_COMMENT_LEN = 2000

AUTH_ACCESS_TOKEN_TTL_MINUTES = int(os.environ.get("SUDERM_ACCESS_TOKEN_TTL_MINUTES", "15"))
AUTH_REFRESH_TOKEN_TTL_DAYS = int(os.environ.get("SUDERM_REFRESH_TOKEN_TTL_DAYS", "7"))
AUTH_REFRESH_COOKIE_NAME = "suderm_refresh_token"
AUTH_REFRESH_COOKIE_SECURE = os.environ.get("SUDERM_SECURE_COOKIES", "").lower() == "true"
AUTH_ALLOWED_USER_TYPES = {"doctor", "researcher", "personal"}

ADMIN_EMAIL = os.environ.get("SUDERM_ADMIN_EMAIL", "admin@suderm.local")
ADMIN_PASSWORD = os.environ.get("SUDERM_ADMIN_PASSWORD", "Admin123!")

_configured_origins = os.environ.get(
    "SUDERM_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOWED_ORIGINS = [o.strip() for o in _configured_origins.split(",") if o.strip()]

REGISTER_FIELD_LIMITS = {
    "email": 254,
    "full_name": 120,
    "hospital": 200,
    "phone_number": 30,
}
