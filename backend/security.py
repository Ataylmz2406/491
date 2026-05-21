import hashlib
import hmac
import re
import secrets
from fastapi import HTTPException
from config import PASSWORD_HASH_ALGORITHM, PASSWORD_HASH_ITERATIONS

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,30}$")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_HASH_ITERATIONS,
    ).hex()
    return f"{PASSWORD_HASH_ALGORITHM}${PASSWORD_HASH_ITERATIONS}${salt}${digest}"


def _legacy_hash_password(password: str) -> str:
    return hashlib.sha256(f"suderm_salt_{password}".encode("utf-8")).hexdigest()


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    if stored_hash.startswith(f"{PASSWORD_HASH_ALGORITHM}$"):
        try:
            _, iterations_raw, salt, expected = stored_hash.split("$", 3)
            iterations = int(iterations_raw)
        except (ValueError, TypeError):
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return hmac.compare_digest(digest, expected)
    return hmac.compare_digest(_legacy_hash_password(password), stored_hash)


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    return True, ""


def validate_email(email: str | None) -> None:
    if email is None:
        return
    if not _EMAIL_RE.match(email.strip()):
        raise HTTPException(status_code=400, detail="Invalid email address format")


def validate_phone(phone: str | None) -> None:
    if not phone:
        return
    if not _PHONE_RE.match(phone.strip()):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
