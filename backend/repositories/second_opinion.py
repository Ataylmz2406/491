import base64
import binascii
import sqlite3

from fastapi import HTTPException

from database import get_db_connection, utc_now_iso
from models import (
    SecondOpinionPostCreate,
    SecondOpinionPostUpdate,
    SecondOpinionCommentCreate,
    SECOND_OPINION_ALLOWED_STATUSES,
    SECOND_OPINION_MAX_IMAGES,
    SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES,
    SECOND_OPINION_MAX_IMAGE_BYTES,
    SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES,
    SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS,
    SECOND_OPINION_MAX_QUESTION_LEN,
    SECOND_OPINION_MAX_COMMENT_LEN,
)
from utils import clean_optional_text
from repositories.auth import build_requester_identity, assert_post_owner


def _validate_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized not in SECOND_OPINION_ALLOWED_STATUSES:
        allowed = ", ".join(sorted(SECOND_OPINION_ALLOWED_STATUSES))
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {allowed}")
    return normalized


def _validate_image_urls(image_urls: list[str]) -> list[str]:
    cleaned: list[str] = []
    total_bytes = 0

    for idx, image_url in enumerate(image_urls, start=1):
        url = clean_optional_text(image_url)
        if not url:
            continue

        if len(url) > SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Image {idx} is too large. Maximum data URL length is {SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS} characters",
            )

        if not url.startswith("data:"):
            raise HTTPException(status_code=400, detail=f"Image {idx} must be a base64 data URL")

        header, separator, encoded_payload = url.partition(",")
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
            raise HTTPException(status_code=400, detail=f"Image {idx} exceeds maximum size ({max_mb:.1f} MB)")

        total_bytes += image_size
        if total_bytes > SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES:
            total_mb = SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"Total image payload exceeds maximum size ({total_mb:.1f} MB)",
            )

        cleaned.append(url)

    return cleaned


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
    row = conn.execute(
        """
        SELECT id, created_at, updated_at, status, is_anonymous,
               created_by_identity, doctor_name, doctor_affiliation, patient_id, current_hypothesis,
               question_text, lesion_location, diagnosis, age_group, sex, skin_tone
        FROM second_opinion_posts
        WHERE id = ?
        """,
        (post_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Second opinion post not found")
    return row


def _build_post_payload(conn: sqlite3.Connection, post_row: sqlite3.Row) -> dict:
    post_id = post_row["id"]
    image_rows = conn.execute(
        "SELECT image_url FROM second_opinion_images WHERE post_id = ? ORDER BY sort_order ASC, id ASC",
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


def list_posts(
    status: str | None,
    doctor_name: str | None,
    patient_id: str | None,
    limit: int,
    offset: int,
) -> list[dict]:
    conn = get_db_connection()
    try:
        where_clauses: list[str] = []
        params: list[object] = []

        if status:
            where_clauses.append("status = ?")
            params.append(_validate_status(status))

        cleaned_doctor_name = clean_optional_text(doctor_name)
        if cleaned_doctor_name:
            where_clauses.append("lower(doctor_name) = ?")
            params.append(cleaned_doctor_name.lower())

        cleaned_patient_id = clean_optional_text(patient_id)
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


def get_post(post_id: int) -> dict:
    conn = get_db_connection()
    try:
        return _build_post_payload(conn, _get_post_or_404(conn, post_id))
    finally:
        conn.close()


def create_post(payload: SecondOpinionPostCreate, token_row: sqlite3.Row) -> dict:
    requester_display_name = (token_row["display_name"] or "").strip()
    requester_identity = build_requester_identity(token_row)

    question_text = clean_optional_text(payload.question_text, SECOND_OPINION_MAX_QUESTION_LEN)
    if not question_text:
        raise HTTPException(status_code=400, detail="question_text is required")

    if len(payload.image_urls) > SECOND_OPINION_MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"A post can include at most {SECOND_OPINION_MAX_IMAGES} images",
        )

    cleaned_image_urls = _validate_image_urls(payload.image_urls)

    conn = get_db_connection()
    try:
        now = utc_now_iso()
        doctor_name = None if payload.is_anonymous else requester_display_name
        doctor_affiliation = None if payload.is_anonymous else clean_optional_text(payload.doctor_affiliation, 255)

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
                now, now, "open", int(payload.is_anonymous),
                requester_identity, doctor_name, doctor_affiliation,
                clean_optional_text(payload.patient_id, 120),
                clean_optional_text(payload.current_hypothesis, 120),
                question_text,
                clean_optional_text(payload.lesion_location, 120),
                clean_optional_text(payload.diagnosis, 120),
                clean_optional_text(payload.age_group, 120),
                clean_optional_text(payload.sex, 32),
                clean_optional_text(payload.skin_tone, 64),
            ),
        )

        post_id = cursor.lastrowid
        for idx, image_url in enumerate(cleaned_image_urls):
            conn.execute(
                "INSERT INTO second_opinion_images (post_id, image_url, sort_order) VALUES (?, ?, ?)",
                (post_id, image_url, idx),
            )

        conn.commit()
        return _build_post_payload(conn, _get_post_or_404(conn, post_id))
    finally:
        conn.close()


def create_comment(post_id: int, payload: SecondOpinionCommentCreate, token_row: sqlite3.Row) -> dict:
    requester_display_name = (token_row["display_name"] or "").strip()
    requester_identity = build_requester_identity(token_row)

    comment_text = clean_optional_text(payload.comment_text, SECOND_OPINION_MAX_COMMENT_LEN)
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
            (post_id, now, int(payload.is_anonymous), requester_identity, author_name, comment_text),
        )
        conn.execute(
            "UPDATE second_opinion_posts SET updated_at = ? WHERE id = ?", (now, post_id)
        )
        conn.commit()

        row = conn.execute(
            "SELECT id, post_id, created_at, is_anonymous, author_name, comment_text FROM second_opinion_comments WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return _serialize_comment(row)
    finally:
        conn.close()


def update_post(post_id: int, payload: SecondOpinionPostUpdate, token_row: sqlite3.Row) -> dict:
    requester_identity = build_requester_identity(token_row)
    requester_display_name = token_row["display_name"]

    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        assert_post_owner(post_row, requester_identity, requester_display_name)

        updates: list[str] = []
        params: list[object] = []

        if payload.question_text is not None:
            question_text = clean_optional_text(payload.question_text, SECOND_OPINION_MAX_QUESTION_LEN)
            if not question_text:
                raise HTTPException(status_code=400, detail="question_text cannot be empty")
            updates.append("question_text = ?")
            params.append(question_text)

        if payload.current_hypothesis is not None:
            updates.append("current_hypothesis = ?")
            params.append(clean_optional_text(payload.current_hypothesis, 120))

        if payload.status is not None:
            updates.append("status = ?")
            params.append(_validate_status(payload.status))

        if not updates:
            raise HTTPException(status_code=400, detail="No updatable fields provided")

        updates.append("updated_at = ?")
        params.append(utc_now_iso())
        params.append(post_id)

        conn.execute(
            f"UPDATE second_opinion_posts SET {', '.join(updates)} WHERE id = ?",
            tuple(params),
        )
        conn.commit()

        return _build_post_payload(conn, _get_post_or_404(conn, post_id))
    finally:
        conn.close()


def delete_post(post_id: int, token_row: sqlite3.Row) -> None:
    requester_identity = build_requester_identity(token_row)
    requester_display_name = token_row["display_name"]

    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        assert_post_owner(post_row, requester_identity, requester_display_name)

        cursor = conn.execute("DELETE FROM second_opinion_posts WHERE id = ?", (post_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Second opinion post not found")
    finally:
        conn.close()
