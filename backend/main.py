import io
import os
import uuid
import sqlite3
import hashlib
import secrets
import base64
import binascii
from datetime import datetime, timezone, timedelta
import torch
import numpy as np
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
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
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS second_opinion_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                is_anonymous INTEGER NOT NULL DEFAULT 0,
                created_by_identity TEXT,
                doctor_name TEXT,
                doctor_affiliation TEXT,
                patient_id TEXT,
                current_hypothesis TEXT,
                question_text TEXT NOT NULL,
                lesion_location TEXT,
                diagnosis TEXT,
                age_group TEXT,
                sex TEXT,
                skin_tone TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS second_opinion_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(post_id) REFERENCES second_opinion_posts(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS second_opinion_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                is_anonymous INTEGER NOT NULL DEFAULT 0,
                created_by_identity TEXT,
                author_name TEXT,
                comment_text TEXT NOT NULL,
                FOREIGN KEY(post_id) REFERENCES second_opinion_posts(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT NOT NULL UNIQUE,
                user_type TEXT NOT NULL,
                subject TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                revoked_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT NOT NULL UNIQUE,
                user_type TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                hospital TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mil10k_labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                image_folder TEXT NOT NULL,
                image_filename TEXT NOT NULL,
                classification TEXT NOT NULL,
                confidence_score INTEGER NOT NULL,
                labeled_by_identity TEXT NOT NULL,
                doctor_name TEXT,
                doctor_affiliation TEXT,
                labeled_at TEXT NOT NULL,
                UNIQUE(image_path, labeled_by_identity)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_diagnoses_patient_date
            ON diagnoses(patient_id, date DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_second_op_posts_status_created
            ON second_opinion_posts(status, created_at DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_second_op_comments_post_created
            ON second_opinion_comments(post_id, created_at ASC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_second_op_images_post_sort
            ON second_opinion_images(post_id, sort_order ASC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry
            ON auth_tokens(expires_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_mil10k_labels_image_path
            ON mil10k_labels(image_path)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_mil10k_labels_folder
            ON mil10k_labels(image_folder)
            """
        )
        conn.commit()
    finally:
        conn.close()
    ensure_schema_columns()
    ensure_second_opinion_schema_columns()
    ensure_second_opinion_strict_constraints()
    ensure_auth_token_schema_columns()
    ensure_mil10k_labels_schema()


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


class SecondOpinionPostCreate(BaseModel):
    is_anonymous: bool = False
    doctor_name: str | None = None
    doctor_affiliation: str | None = None
    patient_id: str | None = None
    current_hypothesis: str | None = None
    question_text: str
    lesion_location: str | None = None
    diagnosis: str | None = None
    age_group: str | None = None
    sex: str | None = None
    skin_tone: str | None = None
    image_urls: list[str] = Field(default_factory=list)


class SecondOpinionPostUpdate(BaseModel):
    question_text: str | None = None
    current_hypothesis: str | None = None
    status: str | None = None


class SecondOpinionCommentCreate(BaseModel):
    is_anonymous: bool = False
    author_name: str | None = None
    comment_text: str


class SecondOpinionCommentOut(BaseModel):
    id: int
    post_id: int
    created_at: str
    is_anonymous: bool
    author_name: str
    comment_text: str


class SecondOpinionPostOut(BaseModel):
    id: int
    created_at: str
    updated_at: str
    status: str
    is_anonymous: bool
    doctor_name: str
    doctor_affiliation: str | None = None
    patient_id: str | None = None
    current_hypothesis: str | None = None
    question_text: str
    lesion_location: str | None = None
    diagnosis: str | None = None
    age_group: str | None = None
    sex: str | None = None
    skin_tone: str | None = None
    image_urls: list[str]
    comments: list[SecondOpinionCommentOut]


SECOND_OPINION_ALLOWED_STATUSES = {"open", "resolved", "archived", "draft"}
SECOND_OPINION_MAX_IMAGES = 12
SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
SECOND_OPINION_MAX_IMAGE_BYTES = 2 * 1024 * 1024
SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024
SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS = 3_000_000
SECOND_OPINION_POST_MAX_REQUEST_BYTES = 12 * 1024 * 1024
SECOND_OPINION_MAX_QUESTION_LEN = 4000
SECOND_OPINION_MAX_COMMENT_LEN = 2000
AUTH_TOKEN_TTL_HOURS = 24
AUTH_ALLOWED_USER_TYPES = {"doctor", "researcher", "personal"}


class AuthLoginRequest(BaseModel):
    user_type: str
    password: str
    doctor_id: str | None = None
    hospital: str | None = None
    email: str | None = None


class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_at: str
    user_type: str
    display_name: str


class AuthMeResponse(BaseModel):
    user_type: str
    display_name: str
    expires_at: str


class ImageLabelCreate(BaseModel):
    image_path: str
    image_folder: str
    image_filename: str
    classification: str
    confidence_score: int


class ImageLabelOut(BaseModel):
    id: int
    image_path: str
    image_folder: str
    image_filename: str
    classification: str
    confidence_score: int
    doctor_name: str
    doctor_affiliation: str | None = None
    labeled_at: str


class MilImageInfo(BaseModel):
    folder: str
    filename: str
    path: str


def _clean_optional_text(value: str | None, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if max_len is not None and len(trimmed) > max_len:
        raise HTTPException(status_code=400, detail=f"Text exceeds maximum length ({max_len})")
    return trimmed


def _validate_second_opinion_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized not in SECOND_OPINION_ALLOWED_STATUSES:
        allowed = ", ".join(sorted(SECOND_OPINION_ALLOWED_STATUSES))
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {allowed}")
    return normalized


def _validate_second_opinion_image_urls(image_urls: list[str]) -> list[str]:
    cleaned_image_urls: list[str] = []
    total_image_bytes = 0

    for idx, image_url in enumerate(image_urls, start=1):
        cleaned_url = _clean_optional_text(image_url)
        if not cleaned_url:
            continue

        if len(cleaned_url) > SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Image {idx} is too large. "
                    f"Maximum data URL length is {SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS} characters"
                ),
            )

        if not cleaned_url.startswith("data:"):
            raise HTTPException(status_code=400, detail=f"Image {idx} must be a base64 data URL")

        header, separator, encoded_payload = cleaned_url.partition(",")
        if separator != "," or ";base64" not in header:
            raise HTTPException(status_code=400, detail=f"Image {idx} is not a valid base64 data URL")

        mime_type = header[5:].split(";", 1)[0].strip().lower()
        if mime_type not in SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES:
            allowed = ", ".join(sorted(SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES))
            raise HTTPException(
                status_code=400,
                detail=f"Image {idx} type is not allowed. Allowed types: {allowed}",
            )

        try:
            image_bytes = base64.b64decode(encoded_payload, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=400, detail=f"Image {idx} has invalid base64 payload")

        image_size = len(image_bytes)
        if image_size == 0:
            raise HTTPException(status_code=400, detail=f"Image {idx} payload is empty")

        if image_size > SECOND_OPINION_MAX_IMAGE_BYTES:
            max_mb = SECOND_OPINION_MAX_IMAGE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"Image {idx} exceeds maximum size ({max_mb:.1f} MB)",
            )

        total_image_bytes += image_size
        if total_image_bytes > SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES:
            total_mb = SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"Total image payload exceeds maximum size ({total_mb:.1f} MB)",
            )

        cleaned_image_urls.append(cleaned_url)

    return cleaned_image_urls


def _build_requester_identity(token_row: sqlite3.Row) -> str:
    user_type = (token_row["user_type"] or "").strip().lower()
    subject = (token_row["subject"] or "").strip().lower()
    if subject:
        return f"{user_type}:{subject}"
    display_name = (token_row["display_name"] or "").strip().lower()
    return f"{user_type}:{display_name}"


def _assert_post_owner(
    post_row: sqlite3.Row,
    requester_identity: str,
    requester_display_name: str,
):
    requester_identity = requester_identity.strip().lower()
    owner_identity = (post_row["created_by_identity"] or "").strip().lower()

    if not owner_identity or owner_identity != requester_identity:
        raise HTTPException(status_code=403, detail="You can only modify your own posts")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return parts[1].strip()


def _verify_auth_token(authorization: str) -> sqlite3.Row:
    token = _extract_bearer_token(authorization)
    token_hash = _hash_token(token)
    conn = get_db_connection()
    try:
        row = conn.execute(
            """
            SELECT user_type, subject, display_name, expires_at, revoked_at
            FROM auth_tokens
            WHERE token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if not row or row["revoked_at"] is not None:
            raise HTTPException(status_code=401, detail="Invalid or revoked token")

        expires_at = row["expires_at"]
        if datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expired")
        return row
    finally:
        conn.close()


def _verify_doctor_token(authorization: str) -> sqlite3.Row:
    token_row = _verify_auth_token(authorization)
    if token_row["user_type"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can perform this action")
    return token_row


def _issue_auth_token(user_type: str, subject: str, display_name: str) -> AuthLoginResponse:
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now.replace(microsecond=0) + timedelta(hours=AUTH_TOKEN_TTL_HOURS)

    conn = get_db_connection()
    try:
        conn.execute(
            """
            INSERT INTO auth_tokens (token_hash, user_type, subject, display_name, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL)
            """,
            (
                token_hash,
                user_type,
                subject,
                display_name,
                now.isoformat(),
                expires_at.isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return AuthLoginResponse(
        access_token=raw_token,
        token_type="bearer",
        expires_at=expires_at.isoformat(),
        user_type=user_type,
        display_name=display_name,
    )


def _public_doctor_name(raw_name: str | None, is_anonymous: bool) -> str:
    if is_anonymous:
        return "Anonymous Doctor"
    if raw_name and raw_name.strip():
        return raw_name.strip()
    return "Doctor"


def _serialize_comment(row: sqlite3.Row) -> dict:
    is_anonymous = bool(row["is_anonymous"])
    return {
        "id": row["id"],
        "post_id": row["post_id"],
        "created_at": row["created_at"],
        "is_anonymous": is_anonymous,
        "author_name": _public_doctor_name(row["author_name"], is_anonymous),
        "comment_text": row["comment_text"],
    }


def _get_post_or_404(conn: sqlite3.Connection, post_id: int) -> sqlite3.Row:
    post_row = conn.execute(
        """
        SELECT id, created_at, updated_at, status, is_anonymous,
               created_by_identity, doctor_name, doctor_affiliation, patient_id, current_hypothesis,
               question_text, lesion_location, diagnosis, age_group, sex, skin_tone
        FROM second_opinion_posts
        WHERE id = ?
        """,
        (post_id,),
    ).fetchone()
    if not post_row:
        raise HTTPException(status_code=404, detail="Second opinion post not found")
    return post_row


def _build_post_payload(conn: sqlite3.Connection, post_row: sqlite3.Row) -> dict:
    post_id = post_row["id"]
    image_rows = conn.execute(
        """
        SELECT image_url
        FROM second_opinion_images
        WHERE post_id = ?
        ORDER BY sort_order ASC, id ASC
        """,
        (post_id,),
    ).fetchall()

    comment_rows = conn.execute(
        """
        SELECT id, post_id, created_at, is_anonymous, author_name, comment_text
        FROM second_opinion_comments
        WHERE post_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
        """,
        (post_id,),
    ).fetchall()

    is_anonymous = bool(post_row["is_anonymous"])
    return {
        "id": post_id,
        "created_at": post_row["created_at"],
        "updated_at": post_row["updated_at"],
        "status": post_row["status"],
        "is_anonymous": is_anonymous,
        "doctor_name": _public_doctor_name(post_row["doctor_name"], is_anonymous),
        "doctor_affiliation": None if is_anonymous else post_row["doctor_affiliation"],
        "patient_id": post_row["patient_id"],
        "current_hypothesis": post_row["current_hypothesis"],
        "question_text": post_row["question_text"],
        "lesion_location": post_row["lesion_location"],
        "diagnosis": post_row["diagnosis"],
        "age_group": post_row["age_group"],
        "sex": post_row["sex"],
        "skin_tone": post_row["skin_tone"],
        "image_urls": [r["image_url"] for r in image_rows],
        "comments": [_serialize_comment(r) for r in comment_rows],
    }


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


def ensure_second_opinion_schema_columns():
    """Adds missing second-opinion columns for older SQLite files."""
    conn = get_db_connection()
    try:
        post_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(second_opinion_posts)").fetchall()
        }
        post_migrations = {
            "status": "TEXT NOT NULL DEFAULT 'open'",
            "is_anonymous": "INTEGER NOT NULL DEFAULT 0",
            "created_by_identity": "TEXT",
            "doctor_name": "TEXT",
            "doctor_affiliation": "TEXT",
            "patient_id": "TEXT",
            "current_hypothesis": "TEXT",
            "question_text": "TEXT",
            "lesion_location": "TEXT",
            "diagnosis": "TEXT",
            "age_group": "TEXT",
            "sex": "TEXT",
            "skin_tone": "TEXT",
            "created_at": "TEXT",
            "updated_at": "TEXT",
        }
        for column_name, column_type in post_migrations.items():
            if column_name not in post_columns:
                conn.execute(
                    f"ALTER TABLE second_opinion_posts ADD COLUMN {column_name} {column_type}"
                )

        comment_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(second_opinion_comments)").fetchall()
        }
        comment_migrations = {
            "created_at": "TEXT",
            "is_anonymous": "INTEGER NOT NULL DEFAULT 0",
            "created_by_identity": "TEXT",
            "author_name": "TEXT",
            "comment_text": "TEXT",
        }
        for column_name, column_type in comment_migrations.items():
            if column_name not in comment_columns:
                conn.execute(
                    f"ALTER TABLE second_opinion_comments ADD COLUMN {column_name} {column_type}"
                )

        image_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(second_opinion_images)").fetchall()
        }
        image_migrations = {
            "sort_order": "INTEGER NOT NULL DEFAULT 0",
            "image_url": "TEXT",
        }
        for column_name, column_type in image_migrations.items():
            if column_name not in image_columns:
                conn.execute(
                    f"ALTER TABLE second_opinion_images ADD COLUMN {column_name} {column_type}"
                )

        # Backfill identity for legacy rows to avoid weak name-based ownership checks.
        if "created_by_identity" in post_columns:
            conn.execute(
                """
                UPDATE second_opinion_posts
                SET created_by_identity = 'doctor:' || lower(trim(doctor_name))
                WHERE (created_by_identity IS NULL OR trim(created_by_identity) = '')
                  AND doctor_name IS NOT NULL
                  AND trim(doctor_name) != ''
                """
            )
            conn.execute(
                """
                UPDATE second_opinion_posts
                SET created_by_identity = 'doctor:' || lower(trim(
                    CASE
                        WHEN instr(doctor_name, '@') > 0 THEN substr(doctor_name, 1, instr(doctor_name, '@') - 1)
                        ELSE doctor_name
                    END
                ))
                WHERE doctor_name IS NOT NULL
                  AND trim(doctor_name) != ''
                  AND (
                      created_by_identity IS NULL
                      OR trim(created_by_identity) = ''
                      OR lower(created_by_identity) LIKE 'doctor:%@%'
                  )
                """
            )

        conn.commit()
    finally:
        conn.close()


def _normalize_sql(sql: str | None) -> str:
    if not sql:
        return ""
    return " ".join(sql.lower().split())


def _has_second_opinion_strict_constraints(conn: sqlite3.Connection) -> bool:
    rows = conn.execute(
        """
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('second_opinion_posts', 'second_opinion_comments', 'second_opinion_images')
        """
    ).fetchall()
    sql_by_name = {row["name"]: _normalize_sql(row["sql"]) for row in rows}

    posts_sql = sql_by_name.get("second_opinion_posts", "")
    comments_sql = sql_by_name.get("second_opinion_comments", "")
    images_sql = sql_by_name.get("second_opinion_images", "")

    posts_ok = (
        "status text not null" in posts_sql
        and "check (status in ('open', 'resolved', 'archived', 'draft'))" in posts_sql
        and "is_anonymous integer not null default 0" in posts_sql
        and "check (is_anonymous in (0, 1))" in posts_sql
        and "question_text text not null" in posts_sql
    )
    comments_ok = (
        "is_anonymous integer not null default 0" in comments_sql
        and "check (is_anonymous in (0, 1))" in comments_sql
        and "comment_text text not null" in comments_sql
    )
    images_ok = (
        "image_url text not null" in images_sql
        and "check (length(image_url) <= " in images_sql
        and "sort_order integer not null default 0" in images_sql
        and "check (sort_order >= 0)" in images_sql
    )
    return posts_ok and comments_ok and images_ok


def ensure_second_opinion_strict_constraints():
    """Rebuilds second-opinion tables with strict constraints when legacy schemas are detected."""
    conn = get_db_connection()
    try:
        if _has_second_opinion_strict_constraints(conn):
            return

        now_iso = utc_now_iso()
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("BEGIN")

        conn.execute(
            """
            CREATE TABLE second_opinion_posts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived', 'draft')),
                is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
                created_by_identity TEXT,
                doctor_name TEXT,
                doctor_affiliation TEXT,
                patient_id TEXT,
                current_hypothesis TEXT,
                question_text TEXT NOT NULL,
                lesion_location TEXT,
                diagnosis TEXT,
                age_group TEXT,
                sex TEXT,
                skin_tone TEXT
            )
            """
        )

        conn.execute(
            """
            INSERT INTO second_opinion_posts_new (
                id, created_at, updated_at, status, is_anonymous,
                created_by_identity, doctor_name, doctor_affiliation, patient_id, current_hypothesis,
                question_text, lesion_location, diagnosis, age_group, sex, skin_tone
            )
            SELECT
                id,
                COALESCE(NULLIF(trim(created_at), ''), ?),
                COALESCE(NULLIF(trim(updated_at), ''), COALESCE(NULLIF(trim(created_at), ''), ?)),
                CASE
                    WHEN lower(trim(status)) IN ('open', 'resolved', 'archived', 'draft') THEN lower(trim(status))
                    ELSE 'open'
                END,
                CASE WHEN CAST(is_anonymous AS INTEGER) = 1 THEN 1 ELSE 0 END,
                NULLIF(trim(created_by_identity), ''),
                NULLIF(trim(doctor_name), ''),
                NULLIF(trim(doctor_affiliation), ''),
                NULLIF(trim(patient_id), ''),
                NULLIF(trim(current_hypothesis), ''),
                COALESCE(NULLIF(trim(question_text), ''), 'Second opinion request'),
                NULLIF(trim(lesion_location), ''),
                NULLIF(trim(diagnosis), ''),
                NULLIF(trim(age_group), ''),
                NULLIF(trim(sex), ''),
                NULLIF(trim(skin_tone), '')
            FROM second_opinion_posts
            """,
            (now_iso, now_iso),
        )

        conn.execute(
            """
            CREATE TABLE second_opinion_comments_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
                created_by_identity TEXT,
                author_name TEXT,
                comment_text TEXT NOT NULL,
                FOREIGN KEY(post_id) REFERENCES second_opinion_posts_new(id) ON DELETE CASCADE
            )
            """
        )

        conn.execute(
            """
            INSERT INTO second_opinion_comments_new (
                id, post_id, created_at, is_anonymous, created_by_identity, author_name, comment_text
            )
            SELECT
                c.id,
                c.post_id,
                COALESCE(NULLIF(trim(c.created_at), ''), ?),
                CASE WHEN CAST(c.is_anonymous AS INTEGER) = 1 THEN 1 ELSE 0 END,
                NULLIF(trim(c.created_by_identity), ''),
                NULLIF(trim(c.author_name), ''),
                COALESCE(NULLIF(trim(c.comment_text), ''), 'No comment')
            FROM second_opinion_comments c
            WHERE c.post_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM second_opinion_posts_new p
                  WHERE p.id = c.post_id
              )
            """,
            (now_iso,),
        )

        conn.execute(
            f"""
            CREATE TABLE second_opinion_images_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                image_url TEXT NOT NULL CHECK (length(image_url) <= {SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS}),
                sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
                FOREIGN KEY(post_id) REFERENCES second_opinion_posts_new(id) ON DELETE CASCADE
            )
            """
        )

        conn.execute(
            """
            INSERT INTO second_opinion_images_new (id, post_id, image_url, sort_order)
            SELECT
                i.id,
                i.post_id,
                trim(i.image_url),
                CASE
                    WHEN CAST(i.sort_order AS INTEGER) >= 0 THEN CAST(i.sort_order AS INTEGER)
                    ELSE 0
                END
            FROM second_opinion_images i
            WHERE i.post_id IS NOT NULL
              AND NULLIF(trim(i.image_url), '') IS NOT NULL
              AND length(trim(i.image_url)) <= ?
              AND EXISTS (
                  SELECT 1
                  FROM second_opinion_posts_new p
                  WHERE p.id = i.post_id
              )
            """,
            (SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS,),
        )

        conn.execute("DROP TABLE second_opinion_images")
        conn.execute("DROP TABLE second_opinion_comments")
        conn.execute("DROP TABLE second_opinion_posts")
        conn.execute("ALTER TABLE second_opinion_posts_new RENAME TO second_opinion_posts")
        conn.execute("ALTER TABLE second_opinion_comments_new RENAME TO second_opinion_comments")
        conn.execute("ALTER TABLE second_opinion_images_new RENAME TO second_opinion_images")

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_second_op_posts_status_created
            ON second_opinion_posts(status, created_at DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_second_op_comments_post_created
            ON second_opinion_comments(post_id, created_at ASC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_second_op_images_post_sort
            ON second_opinion_images(post_id, sort_order ASC)
            """
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.close()


def ensure_auth_token_schema_columns():
    """Adds missing auth token columns for older SQLite files."""
    conn = get_db_connection()
    try:
        token_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(auth_tokens)").fetchall()
        }
        if "subject" not in token_columns:
            conn.execute("ALTER TABLE auth_tokens ADD COLUMN subject TEXT")

        conn.execute(
            """
            UPDATE auth_tokens
            SET subject = lower(trim(display_name))
            WHERE (subject IS NULL OR trim(subject) = '')
              AND display_name IS NOT NULL
              AND trim(display_name) != ''
            """
        )
        conn.commit()
    finally:
        conn.close()


def _has_mil10k_composite_unique_constraint(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table' AND name = 'mil10k_labels'
        """
    ).fetchone()
    table_sql = _normalize_sql(row["sql"] if row else "")
    return "unique(image_path, labeled_by_identity)" in table_sql


def ensure_mil10k_labels_schema():
    """Rebuilds mil10k_labels for doctor-bound labeling when legacy schema is detected."""
    conn = get_db_connection()
    try:
        columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(mil10k_labels)").fetchall()
        }

        if "labeled_by_identity" not in columns:
            conn.execute("ALTER TABLE mil10k_labels ADD COLUMN labeled_by_identity TEXT")

        conn.execute(
            """
            UPDATE mil10k_labels
            SET labeled_by_identity = 'legacy:unknown'
            WHERE labeled_by_identity IS NULL OR trim(labeled_by_identity) = ''
            """
        )
        conn.commit()

        if _has_mil10k_composite_unique_constraint(conn):
            return

        conn.execute("BEGIN")

        conn.execute(
            """
            CREATE TABLE mil10k_labels_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                image_folder TEXT NOT NULL,
                image_filename TEXT NOT NULL,
                classification TEXT NOT NULL,
                confidence_score INTEGER NOT NULL,
                labeled_by_identity TEXT NOT NULL,
                doctor_name TEXT,
                doctor_affiliation TEXT,
                labeled_at TEXT NOT NULL,
                UNIQUE(image_path, labeled_by_identity)
            )
            """
        )

        # Deduplicate legacy rows by selecting the newest label per (image_path, identity).
        conn.execute(
            """
            INSERT INTO mil10k_labels_new (
                image_path, image_folder, image_filename, classification,
                confidence_score, labeled_by_identity, doctor_name, doctor_affiliation,
                labeled_at
            )
            SELECT
                src.image_path,
                src.image_folder,
                src.image_filename,
                src.classification,
                src.confidence_score,
                src.labeled_by_identity,
                src.doctor_name,
                src.doctor_affiliation,
                src.labeled_at
            FROM mil10k_labels src
            WHERE NOT EXISTS (
                SELECT 1
                FROM mil10k_labels newer
                WHERE newer.image_path = src.image_path
                  AND newer.labeled_by_identity = src.labeled_by_identity
                  AND (
                      newer.labeled_at > src.labeled_at
                      OR (newer.labeled_at = src.labeled_at AND newer.id > src.id)
                  )
            )
            """
        )

        conn.execute("DROP TABLE mil10k_labels")
        conn.execute("ALTER TABLE mil10k_labels_new RENAME TO mil10k_labels")

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_mil10k_labels_image_path
            ON mil10k_labels(image_path)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_mil10k_labels_folder
            ON mil10k_labels(image_folder)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_mil10k_labels_identity
            ON mil10k_labels(labeled_by_identity)
            """
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
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


import hashlib
import sqlite3

def _hash_password(password: str) -> str:
    # A simple deterministic hash for demonstration; in prod use passlib/bcrypt
    return hashlib.sha256(f"suderm_salt_{password}".encode('utf-8')).hexdigest()

@app.post("/auth/register", response_model=AuthLoginResponse)
def auth_register(payload: AuthLoginRequest):
    user_type = payload.user_type.strip().lower()
    if user_type not in AUTH_ALLOWED_USER_TYPES:
        allowed = ", ".join(sorted(AUTH_ALLOWED_USER_TYPES))
        raise HTTPException(status_code=400, detail=f"Invalid user_type. Allowed values: {allowed}")

    if len(payload.password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    if user_type == "doctor":
        doctor_id = _clean_optional_text(payload.doctor_id, 120)
        hospital = _clean_optional_text(payload.hospital, 255)
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id is required for doctor registration")
        subject = doctor_id.lower()
        display_name = doctor_id
        if hospital:
            display_name = f"{doctor_id} @ {hospital}"
    else:
        email = _clean_optional_text(payload.email, 255)
        if not email:
            raise HTTPException(status_code=400, detail="email is required for registration")
        subject = email.lower()
        display_name = email
        hospital = None

    password_hash = _hash_password(payload.password)
    now = utc_now_iso()

    conn = get_db_connection()
    try:
        try:
            conn.execute(
                """
                INSERT INTO users (subject, user_type, password_hash, display_name, hospital, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (subject, user_type, password_hash, display_name, hospital, now)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="User already exists")
    finally:
        conn.close()

    return _issue_auth_token(user_type=user_type, subject=subject, display_name=display_name)

@app.post("/auth/login", response_model=AuthLoginResponse)
def auth_login(payload: AuthLoginRequest):
    user_type = payload.user_type.strip().lower()
    if user_type not in AUTH_ALLOWED_USER_TYPES:
        allowed = ", ".join(sorted(AUTH_ALLOWED_USER_TYPES))
        raise HTTPException(status_code=400, detail=f"Invalid user_type. Allowed values: {allowed}")

    if len(payload.password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    if user_type == "doctor":
        doctor_id = _clean_optional_text(payload.doctor_id, 120)
        hospital = _clean_optional_text(payload.hospital, 255)
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id is required for doctor login")
        subject = doctor_id.lower()
        display_name = doctor_id
        if hospital:
            display_name = f"{doctor_id} @ {hospital}"
    else:
        email = _clean_optional_text(payload.email, 255)
        if not email:
            raise HTTPException(status_code=400, detail="email is required for login")
        subject = email.lower()

    password_hash = _hash_password(payload.password)
    
    conn = get_db_connection()
    try:
        user = conn.execute(
            "SELECT display_name FROM users WHERE subject = ? AND user_type = ? AND password_hash = ?",
            (subject, user_type, password_hash)
        ).fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials or user not registered")
            
        display_name = user["display_name"]
    finally:
        conn.close()

    return _issue_auth_token(user_type=user_type, subject=subject, display_name=display_name)


@app.get("/auth/me", response_model=AuthMeResponse)
def auth_me(authorization: str = Header(default="")):
    token_row = _verify_auth_token(authorization)
    return AuthMeResponse(
        user_type=token_row["user_type"],
        display_name=token_row["display_name"],
        expires_at=token_row["expires_at"],
    )


@app.post("/auth/logout")
def auth_logout(authorization: str = Header(default="")):
    token = _extract_bearer_token(authorization)
    token_hash = _hash_token(token)
    now = utc_now_iso()

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            """
            UPDATE auth_tokens
            SET revoked_at = ?
            WHERE token_hash = ? AND revoked_at IS NULL
            """,
            (now, token_hash),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=401, detail="Invalid or already revoked token")
        return {"ok": True}
    finally:
        conn.close()


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


@app.get("/second-opinion/posts", response_model=list[SecondOpinionPostOut])
def list_second_opinion_posts(
    status: str | None = None,
    doctor_name: str | None = None,
    patient_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    conn = get_db_connection()
    try:
        where_clauses = []
        params: list[object] = []

        if status:
            where_clauses.append("status = ?")
            params.append(_validate_second_opinion_status(status))

        cleaned_doctor_name = _clean_optional_text(doctor_name)
        if cleaned_doctor_name:
            where_clauses.append("lower(doctor_name) = ?")
            params.append(cleaned_doctor_name.lower())

        cleaned_patient_id = _clean_optional_text(patient_id)
        if cleaned_patient_id:
            where_clauses.append("patient_id = ?")
            params.append(cleaned_patient_id)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        rows = conn.execute(
            f"""
            SELECT id, created_at, updated_at, status, is_anonymous,
                   doctor_name, doctor_affiliation, patient_id, current_hypothesis,
                   question_text, lesion_location, diagnosis, age_group, sex, skin_tone
            FROM second_opinion_posts
            {where_sql}
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()

        return [_build_post_payload(conn, row) for row in rows]
    finally:
        conn.close()


@app.get("/second-opinion/posts/{post_id}", response_model=SecondOpinionPostOut)
def get_second_opinion_post(post_id: int):
    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        return _build_post_payload(conn, post_row)
    finally:
        conn.close()


@app.post("/second-opinion/posts", response_model=SecondOpinionPostOut)
def create_second_opinion_post(
    payload: SecondOpinionPostCreate,
    authorization: str = Header(default=""),
):
    token_row = _verify_doctor_token(authorization)
    requester_display_name = (token_row["display_name"] or "").strip()
    requester_identity = _build_requester_identity(token_row)

    question_text = _clean_optional_text(payload.question_text, SECOND_OPINION_MAX_QUESTION_LEN)
    if not question_text:
        raise HTTPException(status_code=400, detail="question_text is required")

    if len(payload.image_urls) > SECOND_OPINION_MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"A post can include at most {SECOND_OPINION_MAX_IMAGES} images",
        )

    cleaned_image_urls = _validate_second_opinion_image_urls(payload.image_urls)

    status_value = "open"

    conn = get_db_connection()
    try:
        now = utc_now_iso()
        doctor_name = None if payload.is_anonymous else requester_display_name
        doctor_affiliation = None if payload.is_anonymous else _clean_optional_text(payload.doctor_affiliation, 255)

        cursor = conn.execute(
            """
            INSERT INTO second_opinion_posts (
                created_at, updated_at, status, is_anonymous,
                created_by_identity, doctor_name, doctor_affiliation, patient_id, current_hypothesis,
                question_text, lesion_location, diagnosis, age_group, sex, skin_tone
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now,
                now,
                status_value,
                int(payload.is_anonymous),
                requester_identity,
                doctor_name,
                doctor_affiliation,
                _clean_optional_text(payload.patient_id, 120),
                _clean_optional_text(payload.current_hypothesis, 120),
                question_text,
                _clean_optional_text(payload.lesion_location, 120),
                _clean_optional_text(payload.diagnosis, 120),
                _clean_optional_text(payload.age_group, 120),
                _clean_optional_text(payload.sex, 32),
                _clean_optional_text(payload.skin_tone, 64),
            ),
        )

        post_id = cursor.lastrowid
        for idx, image_url in enumerate(cleaned_image_urls):
            conn.execute(
                """
                INSERT INTO second_opinion_images (post_id, image_url, sort_order)
                VALUES (?, ?, ?)
                """,
                (post_id, image_url, idx),
            )

        conn.commit()
        post_row = _get_post_or_404(conn, post_id)
        return _build_post_payload(conn, post_row)
    finally:
        conn.close()


@app.post("/second-opinion/posts/{post_id}/comments", response_model=SecondOpinionCommentOut)
def create_second_opinion_comment(
    post_id: int,
    payload: SecondOpinionCommentCreate,
    authorization: str = Header(default=""),
):
    token_row = _verify_doctor_token(authorization)
    requester_display_name = (token_row["display_name"] or "").strip()
    requester_identity = _build_requester_identity(token_row)

    comment_text = _clean_optional_text(payload.comment_text, SECOND_OPINION_MAX_COMMENT_LEN)
    if not comment_text:
        raise HTTPException(status_code=400, detail="comment_text is required")

    conn = get_db_connection()
    try:
        _get_post_or_404(conn, post_id)
        now = utc_now_iso()
        author_name = None if payload.is_anonymous else requester_display_name

        cursor = conn.execute(
            """
            INSERT INTO second_opinion_comments (
                post_id, created_at, is_anonymous, created_by_identity, author_name, comment_text
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                post_id,
                now,
                int(payload.is_anonymous),
                requester_identity,
                author_name,
                comment_text,
            ),
        )

        conn.execute(
            """
            UPDATE second_opinion_posts
            SET updated_at = ?
            WHERE id = ?
            """,
            (now, post_id),
        )

        conn.commit()
        row = conn.execute(
            """
            SELECT id, post_id, created_at, is_anonymous, author_name, comment_text
            FROM second_opinion_comments
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        return _serialize_comment(row)
    finally:
        conn.close()


@app.patch("/second-opinion/posts/{post_id}", response_model=SecondOpinionPostOut)
def update_second_opinion_post(
    post_id: int,
    payload: SecondOpinionPostUpdate,
    authorization: str = Header(default=""),
):
    token_row = _verify_doctor_token(authorization)
    requester_identity = _build_requester_identity(token_row)
    requester_display_name = token_row["display_name"]

    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        _assert_post_owner(post_row, requester_identity, requester_display_name)

        updates: list[str] = []
        params: list[object] = []

        if payload.question_text is not None:
            question_text = _clean_optional_text(payload.question_text, SECOND_OPINION_MAX_QUESTION_LEN)
            if not question_text:
                raise HTTPException(status_code=400, detail="question_text cannot be empty")
            updates.append("question_text = ?")
            params.append(question_text)

        if payload.current_hypothesis is not None:
            updates.append("current_hypothesis = ?")
            params.append(_clean_optional_text(payload.current_hypothesis, 120))

        if payload.status is not None:
            updates.append("status = ?")
            params.append(_validate_second_opinion_status(payload.status))

        if not updates:
            raise HTTPException(status_code=400, detail="No updatable fields provided")

        updates.append("updated_at = ?")
        params.append(utc_now_iso())
        params.append(post_id)

        conn.execute(
            f"""
            UPDATE second_opinion_posts
            SET {', '.join(updates)}
            WHERE id = ?
            """,
            tuple(params),
        )
        conn.commit()

        refreshed = _get_post_or_404(conn, post_id)
        return _build_post_payload(conn, refreshed)
    finally:
        conn.close()


@app.delete("/second-opinion/posts/{post_id}")
def delete_second_opinion_post(post_id: int, authorization: str = Header(default="")):
    token_row = _verify_doctor_token(authorization)
    requester_identity = _build_requester_identity(token_row)
    requester_display_name = token_row["display_name"]

    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        _assert_post_owner(post_row, requester_identity, requester_display_name)

        cursor = conn.execute(
            "DELETE FROM second_opinion_posts WHERE id = ?",
            (post_id,),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Second opinion post not found")
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


# --- IMAGE LABELING ENDPOINTS ---
MIL10K_DATASET_PATH = os.path.join(BASE_DIR, "..", "Mil10K images")


def get_all_mil10k_images() -> list[MilImageInfo]:
    """Scan the Mil10K dataset folder and return all image paths."""
    images = []
    
    if not os.path.exists(MIL10K_DATASET_PATH):
        print(f"Warning: Mil10K dataset path not found: {MIL10K_DATASET_PATH}")
        return images
    
    # Common image extensions
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'}
    
    try:
        for folder in os.listdir(MIL10K_DATASET_PATH):
            folder_path = os.path.join(MIL10K_DATASET_PATH, folder)
            
            # Skip if not a directory
            if not os.path.isdir(folder_path):
                continue
            
            # Scan for image files in the folder
            for filename in os.listdir(folder_path):
                file_path = os.path.join(folder_path, filename)
                
                # Skip if not a file or if it's not an image
                if not os.path.isfile(file_path):
                    continue
                
                if not any(filename.lower().endswith(ext) for ext in image_extensions):
                    continue
                
                # Create relative path for storage
                relative_path = os.path.join(folder, filename).replace('\\', '/')
                
                images.append(MilImageInfo(
                    folder=folder,
                    filename=filename,
                    path=relative_path
                ))
    except Exception as e:
        print(f"Error scanning Mil10K dataset: {e}")
    
    return images


@app.get("/mil10k/images", response_model=list[MilImageInfo])
def get_mil10k_images(authorization: str = Header(default="")):
    """Get list of all images in the Mil10K dataset."""
    _verify_doctor_token(authorization)
    images = get_all_mil10k_images()
    return images


@app.get("/mil10k/image-data/{folder}/{filename}")
async def get_mil10k_image_data(folder: str, filename: str, authorization: str = Header(default="")):
    """Get a specific image from the Mil10K dataset as base64 encoded data."""
    _verify_doctor_token(authorization)
    # Validate folder and filename to prevent directory traversal
    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid image path")
    
    file_path = os.path.join(MIL10K_DATASET_PATH, folder, filename)
    
    # Verify the file exists and is within the Mil10K folder
    real_path = os.path.abspath(file_path)
    real_dataset_path = os.path.abspath(MIL10K_DATASET_PATH)
    
    if not real_path.startswith(real_dataset_path):
        raise HTTPException(status_code=400, detail="Invalid image path")
    
    if not os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        with open(real_path, 'rb') as f:
            image_bytes = f.read()
        
        # Determine image type
        ext = os.path.splitext(filename)[1].lower()
        mime_type_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.webp': 'image/webp'
        }
        mime_type = mime_type_map.get(ext, 'image/jpeg')
        
        # Encode to base64
        b64_data = base64.b64encode(image_bytes).decode('utf-8')
        
        return {
            "data": b64_data,
            "mime_type": mime_type,
            "folder": folder,
            "filename": filename
        }
    except Exception as e:
        print(f"Error reading image: {e}")
        raise HTTPException(status_code=500, detail="Could not read image")


@app.post("/mil10k/labels", response_model=ImageLabelOut)
def create_mil10k_label(
    payload: ImageLabelCreate,
    authorization: str = Header(default=""),
):
    """Save a label for a Mil10K image."""
    token_row = _verify_doctor_token(authorization)
    doctor_name = (token_row["display_name"] or "").strip()
    doctor_identity = _build_requester_identity(token_row)
    doctor_affiliation = ""
    
    # Get doctor affiliation from users table if available
    conn = get_db_connection()
    try:
        user = conn.execute(
            "SELECT hospital FROM users WHERE subject = ?",
            (token_row["subject"],)
        ).fetchone()
        if user and user["hospital"]:
            doctor_affiliation = user["hospital"]
    finally:
        conn.close()
    
    # Validate classification
    if payload.classification not in CLASS_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid classification. Allowed: {', '.join(CLASS_NAMES)}"
        )
    
    # Validate confidence score
    if not (1 <= payload.confidence_score <= 5):
        raise HTTPException(status_code=400, detail="Confidence score must be between 1 and 5")
    
    # Insert label into database
    conn = get_db_connection()
    try:
        now = utc_now_iso()
        existing_row = conn.execute(
            """
            SELECT id
            FROM mil10k_labels
            WHERE image_path = ? AND labeled_by_identity = ?
            """,
            (payload.image_path, doctor_identity),
        ).fetchone()

        if existing_row:
            conn.execute(
                """
                UPDATE mil10k_labels
                SET image_folder = ?,
                    image_filename = ?,
                    classification = ?,
                    confidence_score = ?,
                    doctor_name = ?,
                    doctor_affiliation = ?,
                    labeled_at = ?
                WHERE id = ?
                """,
                (
                    payload.image_folder,
                    payload.image_filename,
                    payload.classification,
                    payload.confidence_score,
                    doctor_name,
                    doctor_affiliation,
                    now,
                    existing_row["id"],
                )
            )
            label_id = existing_row["id"]
        else:
            cursor = conn.execute(
                """
                INSERT INTO mil10k_labels (
                    image_path, image_folder, image_filename, classification,
                    confidence_score, labeled_by_identity, doctor_name, doctor_affiliation,
                    labeled_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.image_path,
                    payload.image_folder,
                    payload.image_filename,
                    payload.classification,
                    payload.confidence_score,
                    doctor_identity,
                    doctor_name,
                    doctor_affiliation,
                    now
                )
            )
            label_id = cursor.lastrowid

        conn.commit()

        row = conn.execute(
            """
            SELECT id, image_path, image_folder, image_filename, classification,
                   confidence_score, doctor_name, doctor_affiliation, labeled_at
            FROM mil10k_labels
            WHERE id = ?
            """,
            (label_id,),
        ).fetchone()
        
        # Return the created label
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
        print(f"Error creating label: {e}")
        raise HTTPException(status_code=500, detail="Could not save label")
    finally:
        conn.close()


@app.get("/mil10k/labels/{folder}/{filename}")
def get_mil10k_label(folder: str, filename: str, authorization: str = Header(default="")):
    """Get the current doctor's label for a specific Mil10K image."""
    token_row = _verify_doctor_token(authorization)
    doctor_identity = _build_requester_identity(token_row)

    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid image path")
    
    image_path = f"{folder}/{filename}"
    
    conn = get_db_connection()
    try:
        label = conn.execute(
            """
            SELECT *
            FROM mil10k_labels
            WHERE image_path = ? AND labeled_by_identity = ?
            """,
            (image_path, doctor_identity),
        ).fetchone()
        
        if not label:
            return None  # No label yet
        
        return ImageLabelOut(
            id=label["id"],
            image_path=label["image_path"],
            image_folder=label["image_folder"],
            image_filename=label["image_filename"],
            classification=label["classification"],
            confidence_score=label["confidence_score"],
            doctor_name=label["doctor_name"],
            doctor_affiliation=label["doctor_affiliation"],
            labeled_at=label["labeled_at"]
        )
    except Exception as e:
        print(f"Error getting label: {e}")
        raise HTTPException(status_code=500, detail="Could not get label")
    finally:
        conn.close()


@app.get("/mil10k/labels-stats")
def get_mil10k_labels_stats(authorization: str = Header(default="")):
    """Get statistics for the current doctor, plus global aggregates."""
    token_row = _verify_doctor_token(authorization)
    doctor_identity = _build_requester_identity(token_row)

    conn = get_db_connection()
    try:
        total_images = len(get_all_mil10k_images())
        
        # Doctor-specific progress
        my_labeled_count = conn.execute(
            """
            SELECT COUNT(DISTINCT image_path) as count
            FROM mil10k_labels
            WHERE labeled_by_identity = ?
            """,
            (doctor_identity,),
        ).fetchone()["count"]
        
        my_distribution = conn.execute(
            """
            SELECT classification, COUNT(*) as count
            FROM mil10k_labels
            WHERE labeled_by_identity = ?
            GROUP BY classification
            ORDER BY count DESC
            """,
            (doctor_identity,),
        ).fetchall()
        
        distribution_dict = {row["classification"]: row["count"] for row in my_distribution}

        # Global stats across all doctors
        global_labeled_count = conn.execute(
            "SELECT COUNT(DISTINCT image_path) as count FROM mil10k_labels"
        ).fetchone()["count"]

        global_distribution_rows = conn.execute(
            """
            SELECT classification, COUNT(*) as count
            FROM mil10k_labels
            GROUP BY classification
            ORDER BY count DESC
            """
        ).fetchall()

        global_distribution = {
            row["classification"]: row["count"] for row in global_distribution_rows
        }
        
        return {
            "total_images": total_images,
            "labeled_count": my_labeled_count,
            "unlabeled_count": max(total_images - my_labeled_count, 0),
            "completion_percentage": round((my_labeled_count / total_images * 100) if total_images > 0 else 0, 2),
            "distribution": distribution_dict,
            "global_labeled_count": global_labeled_count,
            "global_unlabeled_count": max(total_images - global_labeled_count, 0),
            "global_completion_percentage": round((global_labeled_count / total_images * 100) if total_images > 0 else 0, 2),
            "global_distribution": global_distribution,
        }
    except Exception as e:
        print(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail="Could not get stats")
    finally:
        conn.close()