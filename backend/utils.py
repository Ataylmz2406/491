from fastapi import HTTPException


def clean_optional_text(value: str | None, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if max_len is not None and len(trimmed) > max_len:
        raise HTTPException(status_code=400, detail=f"Text exceeds maximum length ({max_len})")
    return trimmed
