import base64
import binascii
import secrets
import sqlite3

from fastapi import APIRouter, Header, HTTPException, Query
from config import (
    SECOND_OPINION_ALLOWED_STATUSES,
    SECOND_OPINION_MAX_IMAGES,
    SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES,
    SECOND_OPINION_MAX_IMAGE_BYTES,
    SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES,
    SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS,
    SECOND_OPINION_MAX_QUESTION_LEN,
    SECOND_OPINION_MAX_COMMENT_LEN,
)
from database import get_db_connection, utc_now_iso
from dependencies import verify_doctor_token, build_requester_identity, clean_optional_text
from models.schemas import (
    SecondOpinionCommentCreate,
    SecondOpinionCommentOut,
    SecondOpinionPostCreate,
    SecondOpinionPostOut,
    SecondOpinionPostUpdate,
)

router = APIRouter(prefix="/second-opinion", tags=["second-opinion"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_second_opinion_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized not in SECOND_OPINION_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(sorted(SECOND_OPINION_ALLOWED_STATUSES))}",
        )
    return normalized


def _validate_second_opinion_image_urls(image_urls: list[str]) -> list[str]:
    cleaned: list[str] = []
    total_bytes = 0
    for idx, image_url in enumerate(image_urls, start=1):
        url = clean_optional_text(image_url)
        if not url:
            continue
        if len(url) > SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Image {idx} is too large (max {SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS} chars)",
            )
        if not url.startswith("data:"):
            raise HTTPException(status_code=400, detail=f"Image {idx} must be a base64 data URL")
        header, sep, payload = url.partition(",")
        if sep != "," or ";base64" not in header:
            raise HTTPException(status_code=400, detail=f"Image {idx} is not a valid base64 data URL")
        mime = header[5:].split(";", 1)[0].strip().lower()
        if mime not in SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Image {idx} type not allowed. Allowed: {', '.join(sorted(SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES))}",
            )
        try:
            image_bytes = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=400, detail=f"Image {idx} has invalid base64 payload")
        if not image_bytes:
            raise HTTPException(status_code=400, detail=f"Image {idx} payload is empty")
        if len(image_bytes) > SECOND_OPINION_MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Image {idx} exceeds maximum size ({SECOND_OPINION_MAX_IMAGE_BYTES / (1024*1024):.1f} MB)",
            )
        total_bytes += len(image_bytes)
        if total_bytes > SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Total image payload exceeds maximum size ({SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES / (1024*1024):.1f} MB)",
            )
        cleaned.append(url)
    return cleaned


def _public_doctor_name(raw_name: str | None, is_anonymous: bool) -> str:
    if is_anonymous:
        return raw_name.strip() if raw_name and raw_name.strip() else "Anonymous Doctor"
    return raw_name.strip() if raw_name and raw_name.strip() else "Doctor"


def _serialize_comment(row: sqlite3.Row, requester_identity: str | None = None) -> dict:
    is_anonymous = bool(row["is_anonymous"])
    owner_identity = (row["created_by_identity"] or "").strip().lower()
    viewer_identity = (requester_identity or "").strip().lower()
    return {
        "id": row["id"],
        "post_id": row["post_id"],
        "created_at": row["created_at"],
        "is_anonymous": is_anonymous,
        "author_name": _public_doctor_name(row["author_name"], is_anonymous),
        "comment_text": row["comment_text"],
        "can_delete": bool(viewer_identity and owner_identity == viewer_identity),
    }


def _get_post_or_404(conn: sqlite3.Connection, post_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT id, created_at, updated_at, status, is_anonymous,
               created_by_identity, doctor_name, doctor_affiliation, patient_id, current_hypothesis,
               question_text, lesion_location, diagnosis, age_group, sex, skin_tone
        FROM second_opinion_posts WHERE id = ?
        """,
        (post_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Second opinion post not found")
    return row


def _build_post_payload(
    conn: sqlite3.Connection, post_row: sqlite3.Row, requester_identity: str | None = None
) -> dict:
    post_id = post_row["id"]
    image_rows = conn.execute(
        "SELECT image_url FROM second_opinion_images WHERE post_id = ? ORDER BY sort_order ASC, id ASC",
        (post_id,),
    ).fetchall()
    comment_rows = conn.execute(
        """
        SELECT id, post_id, created_at, is_anonymous, created_by_identity, author_name, comment_text
        FROM second_opinion_comments
        WHERE post_id = ? ORDER BY datetime(created_at) ASC, id ASC
        """,
        (post_id,),
    ).fetchall()
    is_anonymous = bool(post_row["is_anonymous"])
    owner_identity = (post_row["created_by_identity"] or "").strip().lower()
    viewer_identity = (requester_identity or "").strip().lower()
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
        "comments": [_serialize_comment(r, requester_identity) for r in comment_rows],
        "can_delete": bool(viewer_identity and owner_identity == viewer_identity),
    }


def _assert_post_owner(post_row: sqlite3.Row, requester_identity: str, display_name: str) -> None:
    owner = (post_row["created_by_identity"] or "").strip().lower()
    requester = requester_identity.strip().lower()
    if not owner or owner != requester:
        raise HTTPException(status_code=403, detail="You can only modify your own posts")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/posts", response_model=list[SecondOpinionPostOut])
def list_second_opinion_posts(
    status: str | None = None,
    doctor_name: str | None = None,
    patient_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    authorization: str = Header(default=""),
):
    token_row = verify_doctor_token(authorization)
    requester_identity = build_requester_identity(token_row)
    conn = get_db_connection()
    try:
        where_clauses: list[str] = []
        params: list[object] = []

        if status:
            where_clauses.append("status = ?")
            params.append(_validate_second_opinion_status(status))

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
                   created_by_identity, doctor_name, doctor_affiliation, patient_id, current_hypothesis,
                   question_text, lesion_location, diagnosis, age_group, sex, skin_tone
            FROM second_opinion_posts
            {where_sql}
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        return [_build_post_payload(conn, row, requester_identity) for row in rows]
    finally:
        conn.close()


@router.get("/posts/{post_id}", response_model=SecondOpinionPostOut)
def get_second_opinion_post(post_id: int, authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    requester_identity = build_requester_identity(token_row)
    conn = get_db_connection()
    try:
        return _build_post_payload(conn, _get_post_or_404(conn, post_id), requester_identity)
    finally:
        conn.close()


@router.post("/posts", response_model=SecondOpinionPostOut)
def create_second_opinion_post(
    payload: SecondOpinionPostCreate,
    authorization: str = Header(default=""),
):
    token_row = verify_doctor_token(authorization)
    requester_display_name = (token_row["display_name"] or "").strip()
    requester_identity = build_requester_identity(token_row)

    question_text = clean_optional_text(payload.question_text, SECOND_OPINION_MAX_QUESTION_LEN)
    if not question_text:
        raise HTTPException(status_code=400, detail="question_text is required")

    current_hypothesis = clean_optional_text(payload.current_hypothesis, 120)
    if not current_hypothesis:
        raise HTTPException(status_code=400, detail="current_hypothesis is required")

    if len(payload.image_urls) > SECOND_OPINION_MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"A post can include at most {SECOND_OPINION_MAX_IMAGES} images",
        )

    cleaned_image_urls = _validate_second_opinion_image_urls(payload.image_urls)
    if not cleaned_image_urls:
        raise HTTPException(status_code=400, detail="At least one image is required")

    conn = get_db_connection()
    try:
        now = utc_now_iso()
        doctor_name = (
            f"Dr. Anon#{secrets.randbelow(9000) + 1000}"
            if payload.is_anonymous
            else requester_display_name
        )
        doctor_affiliation = None if payload.is_anonymous else clean_optional_text(payload.doctor_affiliation, 255)

        cursor = conn.execute(
            """
            INSERT INTO second_opinion_posts (
                created_at, updated_at, status, is_anonymous, created_by_identity,
                doctor_name, doctor_affiliation, patient_id, current_hypothesis,
                question_text, lesion_location, diagnosis, age_group, sex, skin_tone
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            """,
            (
                now, now, "open", int(payload.is_anonymous), requester_identity,
                doctor_name, doctor_affiliation,
                clean_optional_text(payload.patient_id, 120),
                current_hypothesis, question_text,
                clean_optional_text(payload.lesion_location, 120),
                clean_optional_text(payload.diagnosis, 120),
                clean_optional_text(payload.age_group, 120),
                clean_optional_text(payload.sex, 32),
                clean_optional_text(payload.skin_tone, 64),
            ),
        )
        post_id = cursor.fetchone()["id"]
        for idx, image_url in enumerate(cleaned_image_urls):
            conn.execute(
                "INSERT INTO second_opinion_images (post_id, image_url, sort_order) VALUES (?, ?, ?)",
                (post_id, image_url, idx),
            )
        conn.commit()
        return _build_post_payload(conn, _get_post_or_404(conn, post_id), requester_identity)
    finally:
        conn.close()


@router.patch("/posts/{post_id}", response_model=SecondOpinionPostOut)
def update_second_opinion_post(
    post_id: int,
    payload: SecondOpinionPostUpdate,
    authorization: str = Header(default=""),
):
    token_row = verify_doctor_token(authorization)
    requester_identity = build_requester_identity(token_row)
    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        _assert_post_owner(post_row, requester_identity, token_row["display_name"])

        updates: list[str] = []
        params: list[object] = []

        if payload.question_text is not None:
            qt = clean_optional_text(payload.question_text, SECOND_OPINION_MAX_QUESTION_LEN)
            if not qt:
                raise HTTPException(status_code=400, detail="question_text cannot be empty")
            updates.append("question_text = ?")
            params.append(qt)

        if payload.current_hypothesis is not None:
            updates.append("current_hypothesis = ?")
            params.append(clean_optional_text(payload.current_hypothesis, 120))

        if payload.status is not None:
            updates.append("status = ?")
            params.append(_validate_second_opinion_status(payload.status))

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
        return _build_post_payload(conn, _get_post_or_404(conn, post_id), requester_identity)
    finally:
        conn.close()


@router.delete("/posts/{post_id}")
def delete_second_opinion_post(post_id: int, authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    requester_identity = build_requester_identity(token_row)
    conn = get_db_connection()
    try:
        post_row = _get_post_or_404(conn, post_id)
        _assert_post_owner(post_row, requester_identity, token_row["display_name"])
        cursor = conn.execute("DELETE FROM second_opinion_posts WHERE id = ?", (post_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Second opinion post not found")
        return {"ok": True}
    finally:
        conn.close()


@router.post("/posts/{post_id}/comments", response_model=SecondOpinionCommentOut)
def create_second_opinion_comment(
    post_id: int,
    payload: SecondOpinionCommentCreate,
    authorization: str = Header(default=""),
):
    token_row = verify_doctor_token(authorization)
    requester_display_name = (token_row["display_name"] or "").strip()
    requester_identity = build_requester_identity(token_row)

    comment_text = clean_optional_text(payload.comment_text, SECOND_OPINION_MAX_COMMENT_LEN)
    if not comment_text:
        raise HTTPException(status_code=400, detail="comment_text is required")

    conn = get_db_connection()
    try:
        _get_post_or_404(conn, post_id)
        now = utc_now_iso()
        author_name = (
            f"Dr. Anon#{secrets.randbelow(9000) + 1000}"
            if payload.is_anonymous
            else requester_display_name
        )
        cursor = conn.execute(
            """
            INSERT INTO second_opinion_comments
              (post_id, created_at, is_anonymous, created_by_identity, author_name, comment_text)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
            """,
            (post_id, now, int(payload.is_anonymous), requester_identity, author_name, comment_text),
        )
        new_comment_id = cursor.fetchone()["id"]
        conn.execute(
            "UPDATE second_opinion_posts SET updated_at = ? WHERE id = ?", (now, post_id)
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, post_id, created_at, is_anonymous, created_by_identity, author_name, comment_text
            FROM second_opinion_comments WHERE id = ?
            """,
            (new_comment_id,),
        ).fetchone()
        return _serialize_comment(row, requester_identity)
    finally:
        conn.close()


@router.delete("/posts/{post_id}/comments/{comment_id}")
def delete_second_opinion_comment(
    post_id: int,
    comment_id: int,
    authorization: str = Header(default=""),
):
    token_row = verify_doctor_token(authorization)
    requester_identity = build_requester_identity(token_row).strip().lower()
    conn = get_db_connection()
    try:
        _get_post_or_404(conn, post_id)
        comment_row = conn.execute(
            "SELECT id, post_id, created_by_identity FROM second_opinion_comments WHERE id = ? AND post_id = ?",
            (comment_id, post_id),
        ).fetchone()
        if not comment_row:
            raise HTTPException(status_code=404, detail="Second opinion comment not found")

        owner_identity = (comment_row["created_by_identity"] or "").strip().lower()
        if not owner_identity or owner_identity != requester_identity:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")

        cursor = conn.execute(
            "DELETE FROM second_opinion_comments WHERE id = ? AND post_id = ?",
            (comment_id, post_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Second opinion comment not found")

        conn.execute(
            "UPDATE second_opinion_posts SET updated_at = ? WHERE id = ?",
            (utc_now_iso(), post_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
