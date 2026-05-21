import secrets

import psycopg2.errors
from fastapi import APIRouter, Header, HTTPException, Request, Response, Cookie
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import AUTH_ALLOWED_USER_TYPES, AUTH_REFRESH_COOKIE_NAME, REGISTER_FIELD_LIMITS
from database import get_db_connection, utc_now_iso
from dependencies import (
    verify_auth_token,
    verify_refresh_token,
    revoke_raw_token,
    extract_bearer_token,
    issue_auth_session,
    clear_refresh_cookie,
    get_user_profile,
    clean_optional_text,
)
from models.schemas import AuthLoginRequest, AuthLoginResponse, AuthMeResponse
from security import hash_password, verify_password, validate_password, validate_email, validate_phone

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def _validate_register_fields(payload: AuthLoginRequest) -> None:
    for field, max_len in REGISTER_FIELD_LIMITS.items():
        value = getattr(payload, field, None)
        if value and len(value.strip()) > max_len:
            raise HTTPException(
                status_code=400,
                detail=f"{field} exceeds maximum length of {max_len} characters",
            )
    validate_phone(payload.phone_number)


@router.post("/register", response_model=AuthLoginResponse)
@limiter.limit("5/minute")
def auth_register(request: Request, payload: AuthLoginRequest, response: Response):
    user_type = payload.user_type.strip().lower()
    if user_type not in AUTH_ALLOWED_USER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user_type. Allowed values: {', '.join(sorted(AUTH_ALLOWED_USER_TYPES))}",
        )

    is_valid, error_msg = validate_password(payload.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    if payload.confirm_password != payload.password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    validate_email(payload.email)
    _validate_register_fields(payload)

    if user_type == "doctor":
        hospital = clean_optional_text(payload.hospital, 255)
        full_name = clean_optional_text(payload.full_name, 255)
        phone_number = clean_optional_text(payload.phone_number, 20)
        email = clean_optional_text(payload.email, 255)
        if not email:
            raise HTTPException(status_code=400, detail="email is required for doctor registration")
        if not full_name:
            raise HTTPException(status_code=400, detail="full_name is required for doctor registration")
        doctor_id = f"DR{secrets.token_hex(3).upper()}"
        subject = email.lower()
        display_name = full_name
    else:
        email = clean_optional_text(payload.email, 255)
        full_name = clean_optional_text(payload.full_name, 255)
        phone_number = clean_optional_text(payload.phone_number, 20)
        if not email:
            raise HTTPException(status_code=400, detail="email is required for registration")
        if not full_name:
            raise HTTPException(status_code=400, detail="full_name is required for registration")
        subject = email.lower()
        display_name = full_name
        hospital = None
        doctor_id = None

    password_hash = hash_password(payload.password)
    now = utc_now_iso()

    conn = get_db_connection()
    try:
        try:
            conn.execute(
                """
                INSERT INTO users
                  (subject, user_type, password_hash, display_name, email, full_name,
                   phone_number, hospital, doctor_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (subject, user_type, password_hash, display_name, email,
                 full_name, phone_number, hospital, doctor_id, now),
            )
            conn.commit()
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="User already exists")
    finally:
        conn.close()

    return issue_auth_session(
        response=response,
        user_type=user_type,
        subject=subject,
        display_name=display_name,
        email=email,
        full_name=full_name,
        phone_number=phone_number,
        hospital=hospital,
        doctor_id=doctor_id,
    )


@router.post("/login", response_model=AuthLoginResponse)
@limiter.limit("10/minute")
def auth_login(request: Request, payload: AuthLoginRequest, response: Response):
    user_type = payload.user_type.strip().lower()
    if user_type not in AUTH_ALLOWED_USER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user_type. Allowed values: {', '.join(sorted(AUTH_ALLOWED_USER_TYPES))}",
        )

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required")

    email = clean_optional_text(payload.email, 255)
    if not email:
        raise HTTPException(status_code=400, detail="email is required for login")
    subject = email.lower()

    conn = get_db_connection()
    try:
        user = conn.execute(
            """
            SELECT display_name, password_hash, email, full_name, phone_number,
                   hospital, doctor_id, is_admin
            FROM users WHERE subject = ? AND user_type = ?
            """,
            (subject, user_type),
        ).fetchone()

        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials or user not registered")

        display_name = user["display_name"]

        from config import PASSWORD_HASH_ALGORITHM
        if not user["password_hash"].startswith(f"{PASSWORD_HASH_ALGORITHM}$"):
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE subject = ? AND user_type = ?",
                (hash_password(payload.password), subject, user_type),
            )
            conn.commit()

        email = user["email"]
        full_name = user["full_name"]
        phone_number = user["phone_number"]
        hospital = user["hospital"]
        doctor_id = user["doctor_id"]
        is_admin = bool(user["is_admin"])
    finally:
        conn.close()

    return issue_auth_session(
        response=response,
        user_type=user_type,
        subject=subject,
        display_name=display_name,
        email=email,
        full_name=full_name,
        phone_number=phone_number,
        hospital=hospital,
        doctor_id=doctor_id,
        is_admin=is_admin,
    )


@router.post("/refresh", response_model=AuthLoginResponse)
def auth_refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=AUTH_REFRESH_COOKIE_NAME),
):
    token_row = verify_refresh_token(refresh_token)
    revoke_raw_token(refresh_token, "refresh")
    profile = get_user_profile(token_row["user_type"], token_row["subject"])
    return issue_auth_session(
        response=response,
        user_type=token_row["user_type"],
        subject=token_row["subject"],
        display_name=profile["display_name"],
        email=profile["email"],
        full_name=profile["full_name"],
        phone_number=profile["phone_number"],
        hospital=profile["hospital"],
        doctor_id=profile["doctor_id"],
        is_admin=bool(profile.get("is_admin", 0)),
    )


@router.get("/me", response_model=AuthMeResponse)
def auth_me(authorization: str = Header(default="")):
    token_row = verify_auth_token(authorization)
    profile = get_user_profile(token_row["user_type"], token_row["subject"])
    return AuthMeResponse(
        user_type=token_row["user_type"],
        display_name=profile["display_name"],
        expires_at=token_row["expires_at"],
        email=profile["email"],
        full_name=profile["full_name"],
        phone_number=profile["phone_number"],
        hospital=profile["hospital"],
        doctor_id=profile["doctor_id"],
        is_admin=bool(profile.get("is_admin", 0)),
    )


@router.post("/logout")
def auth_logout(
    response: Response,
    authorization: str = Header(default=""),
    refresh_token: str | None = Cookie(default=None, alias=AUTH_REFRESH_COOKIE_NAME),
):
    if authorization:
        try:
            revoke_raw_token(extract_bearer_token(authorization), "access")
        except HTTPException:
            pass
    if refresh_token:
        revoke_raw_token(refresh_token, "refresh")
    clear_refresh_cookie(response)
    return {"ok": True}
