import secrets
import sqlite3
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Response, Cookie
from fastapi.responses import Response as FastAPIResponse

from config import (
    AUTH_ACCESS_TOKEN_TTL_MINUTES,
    AUTH_REFRESH_TOKEN_TTL_DAYS,
    AUTH_REFRESH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_SECURE,
)
from database import get_db_connection, utc_now_iso
from models.schemas import AuthLoginResponse
from security import hash_token, hash_password, verify_password


# ---------------------------------------------------------------------------
# Shared text helpers
# ---------------------------------------------------------------------------

def clean_optional_text(value: str | None, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if max_len is not None and len(trimmed) > max_len:
        raise HTTPException(status_code=400, detail=f"Text exceeds maximum length ({max_len})")
    return trimmed


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return parts[1].strip()


def verify_auth_token(authorization: str) -> sqlite3.Row:
    token = extract_bearer_token(authorization)
    token_hash = hash_token(token)
    conn = get_db_connection()
    try:
        row = conn.execute(
            """
            SELECT user_type, subject, display_name, expires_at, revoked_at
            FROM auth_tokens
            WHERE token_hash = ? AND token_type = 'access'
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


def verify_doctor_token(authorization: str) -> sqlite3.Row:
    token_row = verify_auth_token(authorization)
    if token_row["user_type"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can perform this action")
    return token_row


def verify_admin_token(authorization: str) -> sqlite3.Row:
    token_row = verify_auth_token(authorization)
    conn = get_db_connection()
    try:
        user = conn.execute(
            "SELECT is_admin FROM users WHERE subject = ? AND user_type = ?",
            (token_row["subject"], token_row["user_type"]),
        ).fetchone()
        if not user or not user["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        return token_row
    finally:
        conn.close()


def verify_refresh_token(refresh_token: str | None) -> sqlite3.Row:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    token_hash = hash_token(refresh_token)
    conn = get_db_connection()
    try:
        row = conn.execute(
            """
            SELECT user_type, subject, display_name, expires_at, revoked_at
            FROM auth_tokens
            WHERE token_hash = ? AND token_type = 'refresh'
            """,
            (token_hash,),
        ).fetchone()
        if not row or row["revoked_at"] is not None:
            raise HTTPException(status_code=401, detail="Invalid or revoked refresh token")
        if datetime.fromisoformat(row["expires_at"]) <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Refresh token expired")
        return row
    finally:
        conn.close()


def revoke_raw_token(raw_token: str | None, token_type: str | None = None) -> None:
    if not raw_token:
        return
    token_hash = hash_token(raw_token)
    now = utc_now_iso()
    conn = get_db_connection()
    try:
        if token_type:
            conn.execute(
                "UPDATE auth_tokens SET revoked_at = ? WHERE token_hash = ? AND token_type = ? AND revoked_at IS NULL",
                (now, token_hash, token_type),
            )
        else:
            conn.execute(
                "UPDATE auth_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
                (now, token_hash),
            )
        conn.commit()
    finally:
        conn.close()


def issue_token_record(
    user_type: str, subject: str, display_name: str, token_type: str, expires_at: datetime
) -> str:
    raw_token = secrets.token_urlsafe(32)
    token_hash_val = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    conn = get_db_connection()
    try:
        conn.execute(
            """
            INSERT INTO auth_tokens
              (token_hash, token_type, user_type, subject, display_name, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
            """,
            (token_hash_val, token_type, user_type, subject, display_name, now.isoformat(), expires_at.isoformat()),
        )
        conn.commit()
    finally:
        conn.close()
    return raw_token


def purge_expired_tokens() -> int:
    now = utc_now_iso()
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM auth_tokens WHERE expires_at <= ? OR revoked_at IS NOT NULL",
            (now,),
        )
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=AUTH_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=AUTH_REFRESH_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=AUTH_REFRESH_COOKIE_NAME, path="/")


def issue_auth_session(
    response: Response,
    user_type: str,
    subject: str,
    display_name: str,
    email: str | None = None,
    full_name: str | None = None,
    phone_number: str | None = None,
    hospital: str | None = None,
    doctor_id: str | None = None,
    is_admin: bool = False,
) -> AuthLoginResponse:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    access_expires_at = now + timedelta(minutes=AUTH_ACCESS_TOKEN_TTL_MINUTES)
    refresh_expires_at = now + timedelta(days=AUTH_REFRESH_TOKEN_TTL_DAYS)
    raw_access = issue_token_record(user_type, subject, display_name, "access", access_expires_at)
    raw_refresh = issue_token_record(user_type, subject, display_name, "refresh", refresh_expires_at)
    set_refresh_cookie(response, raw_refresh)
    return AuthLoginResponse(
        access_token=raw_access,
        token_type="bearer",
        expires_at=access_expires_at.isoformat(),
        user_type=user_type,
        display_name=display_name,
        email=email,
        full_name=full_name,
        phone_number=phone_number,
        hospital=hospital,
        doctor_id=doctor_id,
        is_admin=is_admin,
    )


def get_user_profile(user_type: str, subject: str) -> dict:
    conn = get_db_connection()
    try:
        row = conn.execute(
            """
            SELECT display_name, email, full_name, phone_number, hospital, doctor_id, is_admin
            FROM users WHERE subject = ? AND user_type = ?
            """,
            (subject, user_type),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User profile not found")
        return dict(row)
    finally:
        conn.close()


def build_requester_identity(token_row: sqlite3.Row) -> str:
    user_type = (token_row["user_type"] or "").strip().lower()
    subject = (token_row["subject"] or "").strip().lower()
    if subject:
        return f"{user_type}:{subject}"
    display_name = (token_row["display_name"] or "").strip().lower()
    return f"{user_type}:{display_name}"


def doctor_scope_values(token_row: sqlite3.Row) -> tuple[str, str]:
    doctor_id = (token_row["subject"] or token_row["display_name"] or "").strip()
    doctor_name = (token_row["display_name"] or "").strip()
    return doctor_id, doctor_name
