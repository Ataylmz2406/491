import asyncio
import hashlib
import hmac
import logging
import os
import uuid

import torch
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import state
from config import (
    ALLOW_UNSAFE_CHECKPOINT_LOAD,
    ALLOW_UNTRUSTED_CHECKPOINT,
    BASE_DIR,
    CORS_ALLOWED_ORIGINS,
    DEVICE,
    HEATMAP_DIR,
    INFERENCE_MAX_CONCURRENCY,
    MODEL_WEIGHTS_SHA256,
    MODEL_WEIGHTS,
    SECOND_OPINION_POST_MAX_REQUEST_BYTES,
)
from database import ensure_admin_account, init_db
from dependencies import purge_expired_tokens
from model_utils import (
    IMG_SIZE,
    MODEL_ARCHITECTURE,
    MODEL_DISPLAY_NAME,
    build_swinv2_model_from_checkpoint,
    get_inference_transform,
    validate_checkpoint_class_order,
)
from routers import auth, admin, doctor, history, second_opinion, predict, labeling

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("suderm")
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
FRONTEND_INDEX = os.path.join(FRONTEND_DIST, "index.html")


def _file_sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as file_obj:
        for chunk in iter(lambda: file_obj.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verify_model_weights_file(path: str) -> bool:
    if not MODEL_WEIGHTS_SHA256:
        if ALLOW_UNTRUSTED_CHECKPOINT:
            logger.warning("Model checkpoint hash verification is disabled")
            return False
        raise RuntimeError("SUDERM_MODEL_CHECKPOINT_SHA256 must be configured")

    actual_hash = _file_sha256(path)
    if not hmac.compare_digest(actual_hash, MODEL_WEIGHTS_SHA256):
        if ALLOW_UNTRUSTED_CHECKPOINT:
            logger.warning(
                "Model checkpoint hash mismatch ignored because SUDERM_ALLOW_UNTRUSTED_CHECKPOINT=true: %s",
                actual_hash,
            )
            return False
        raise RuntimeError(
            "Model checkpoint hash mismatch. "
            f"Expected {MODEL_WEIGHTS_SHA256}, got {actual_hash}."
        )
    return True


def _load_model_checkpoint(path: str):
    checkpoint_hash_verified = _verify_model_weights_file(path)
    try:
        return torch.load(path, map_location="cpu", weights_only=True)
    except Exception as safe_load_error:
        if not checkpoint_hash_verified and not ALLOW_UNSAFE_CHECKPOINT_LOAD:
            raise RuntimeError(
                "Checkpoint could not be loaded with torch.load(weights_only=True). "
                "Configure a trusted SHA256 checkpoint hash, convert it to a safe format, "
                "or set SUDERM_ALLOW_UNSAFE_CHECKPOINT_LOAD=true only for a trusted local checkpoint."
            ) from safe_load_error

        if checkpoint_hash_verified:
            logger.warning("Falling back to pickle checkpoint loading after checkpoint trust verification")
        else:
            logger.warning(
                "Falling back to unsafe pickle checkpoint loading because "
                "SUDERM_ALLOW_UNSAFE_CHECKPOINT_LOAD=true"
            )
        return torch.load(path, map_location="cpu", weights_only=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.inference_semaphore = asyncio.Semaphore(INFERENCE_MAX_CONCURRENCY)
    os.makedirs(HEATMAP_DIR, exist_ok=True)

    init_db()
    ensure_admin_account()

    purged = purge_expired_tokens()
    logger.info("Startup token cleanup: removed %d expired/revoked token(s)", purged)

    logger.info("Initializing %s model on %s", MODEL_DISPLAY_NAME, DEVICE)
    if not os.path.exists(MODEL_WEIGHTS):
        raise RuntimeError(f"Model weights file not found: {MODEL_WEIGHTS}")

    try:
        checkpoint = _load_model_checkpoint(MODEL_WEIGHTS)
        validate_checkpoint_class_order(checkpoint)
        state.model = build_swinv2_model_from_checkpoint(checkpoint)
        logger.info(
            "Loaded %s checkpoint: fold=%s, image_size=%s, classes=%s",
            MODEL_ARCHITECTURE,
            checkpoint.get("fold", "unknown"),
            checkpoint.get("image_size", IMG_SIZE),
            checkpoint.get("classes", []),
        )
    except Exception as e:
        raise RuntimeError(f"Could not initialize {MODEL_DISPLAY_NAME}") from e

    state.model.to(DEVICE)
    state.model.eval()
    state.transform = get_inference_transform(IMG_SIZE)

    logger.info("Running model warmup on %s", DEVICE)
    try:
        with torch.no_grad():
            dummy = torch.zeros((1, 3, IMG_SIZE, IMG_SIZE), device=DEVICE)
            state.model(dummy)
            del dummy
        if DEVICE.type == "mps":
            torch.mps.empty_cache()
        logger.info("Model warmup complete")
    except Exception as e:
        logger.warning("Model warmup failed (non-fatal): %s", e)

    yield

    state.model = None
    state.transform = None


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(lifespan=lifespan, title="SUDerm API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

os.makedirs(HEATMAP_DIR, exist_ok=True)
app.mount("/heatmap", StaticFiles(directory=HEATMAP_DIR), name="heatmaps")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    if request.scope.get("path", "").startswith("/api/"):
        request.scope["path"] = request.scope["path"][4:]
    return await call_next(request)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def enforce_second_opinion_request_limit(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/second-opinion/posts":
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                cl = int(content_length)
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"})
            if cl > SECOND_OPINION_POST_MAX_REQUEST_BYTES:
                max_mb = SECOND_OPINION_POST_MAX_REQUEST_BYTES / (1024 * 1024)
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request payload too large (max {max_mb:.1f} MB)"},
                )
    return await call_next(request)


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(doctor.router)
app.include_router(history.router)
app.include_router(second_opinion.router)
app.include_router(predict.router)
app.include_router(labeling.router)


@app.get("/")
def read_root():
    if os.path.exists(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    return {"message": "SUDerm - MILK10k SwinV2 Skin Lesion Analysis API (Sabanci University)"}


@app.get("/health")
def health_check():
    db_ok = False
    try:
        from database import get_db_connection
        conn = get_db_connection()
        conn.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception:
        pass
    return {
        "status": "ok" if (state.model is not None and db_ok) else "degraded",
        "model": {
            "loaded": state.model is not None,
            "name": MODEL_DISPLAY_NAME,
            "architecture": MODEL_ARCHITECTURE,
            "device": str(DEVICE),
        },
        "database": {"connected": db_ok},
    }


if os.path.isdir(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        requested = os.path.abspath(os.path.join(FRONTEND_DIST, full_path))
        if os.path.commonpath([FRONTEND_DIST, requested]) == FRONTEND_DIST and os.path.isfile(requested):
            return FileResponse(requested)
        return FileResponse(FRONTEND_INDEX)
