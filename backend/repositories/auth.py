import hashlib
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException

from database import get_db_connection, utc_now_iso
from models import AuthLoginRequest, AuthLoginResponse, AuthMeResponse, AUTH_TOKEN_TTL_HOURS, AUTH_ALLOWED_USER_TYPES
from utils import clean_optional_text


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return parts[1].strip()


def verify_token(authorization: str) -> sqlite3.Row:
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
        if datetime.fromisoformat(row["expires_at"]) <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expired")
        return row
    finally:
        conn.close()


def issue_token(user_type: str, subject: str, display_name: str) -> AuthLoginResponse:
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
            (token_hash, user_type, subject, display_name, now.isoformat(), expires_at.isoformat()),
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


def revoke_token(authorization: str) -> None:
    token = _extract_bearer_token(authorization)
    token_hash = _hash_token(token)
    now = utc_now_iso()
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "UPDATE auth_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
            (now, token_hash),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=401, detail="Invalid or already revoked token")
    finally:
        conn.close()


def build_requester_identity(token_row: sqlite3.Row) -> str:
    user_type = (token_row["user_type"] or "").strip().lower()
    subject = (token_row["subject"] or "").strip().lower()
    if subject:
        return f"{user_type}:{subject}"
    display_name = (token_row["display_name"] or "").strip().lower()
    return f"{user_type}:{display_name}"


def assert_post_owner(post_row: sqlite3.Row, requester_identity: str, requester_display_name: str) -> None:
    owner_identity = (post_row["created_by_identity"] or "").strip().lower()
    if not owner_identity or owner_identity != requester_identity.strip().lower():
        raise HTTPException(status_code=403, detail="You can only modify your own posts")


def login(payload: AuthLoginRequest) -> AuthLoginResponse:
    user_type = payload.user_type.strip().lower()
    if user_type not in AUTH_ALLOWED_USER_TYPES:
        allowed = ", ".join(sorted(AUTH_ALLOWED_USER_TYPES))
        raise HTTPException(status_code=400, detail=f"Invalid user_type. Allowed values: {allowed}")

    if len(payload.password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    if user_type == "doctor":
        doctor_id = clean_optional_text(payload.doctor_id, 120)
        hospital = clean_optional_text(payload.hospital, 255)
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id is required for doctor login")
        subject = doctor_id.lower()
        display_name = f"{doctor_id} @ {hospital}" if hospital else doctor_id
    else:
        email = clean_optional_text(payload.email, 255)
        if not email:
            raise HTTPException(status_code=400, detail="email is required for this user type")
        subject = email.lower()
        display_name = email

    return issue_token(user_type=user_type, subject=subject, display_name=display_name)
