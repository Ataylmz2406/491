from fastapi import APIRouter, Header, HTTPException
from database import get_db_connection, utc_now_iso
from dependencies import verify_admin_token, purge_expired_tokens

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def admin_stats(authorization: str = Header(default="")):
    _verify = verify_admin_token(authorization)
    conn = get_db_connection()
    try:
        now = utc_now_iso()
        return {
            "users": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "users_by_type": {
                row["user_type"]: row["cnt"]
                for row in conn.execute(
                    "SELECT user_type, COUNT(*) AS cnt FROM users GROUP BY user_type"
                ).fetchall()
            },
            "diagnoses": conn.execute("SELECT COUNT(*) FROM diagnoses").fetchone()[0],
            "second_opinion_posts": conn.execute(
                "SELECT COUNT(*) FROM second_opinion_posts"
            ).fetchone()[0],
            "active_tokens": conn.execute(
                "SELECT COUNT(*) FROM auth_tokens WHERE expires_at > ? AND revoked_at IS NULL",
                (now,),
            ).fetchone()[0],
            "expired_tokens_pending_cleanup": conn.execute(
                "SELECT COUNT(*) FROM auth_tokens WHERE expires_at <= ? OR revoked_at IS NOT NULL",
                (now,),
            ).fetchone()[0],
            "mil10k_labels": conn.execute("SELECT COUNT(*) FROM mil10k_labels").fetchone()[0],
        }
    finally:
        conn.close()


@router.get("/users")
def admin_list_users(authorization: str = Header(default="")):
    verify_admin_token(authorization)
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, subject, user_type, display_name, email, full_name,
                   phone_number, hospital, doctor_id, created_at, is_admin
            FROM users ORDER BY created_at DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.delete("/tokens/expired")
def admin_purge_expired_tokens(authorization: str = Header(default="")):
    verify_admin_token(authorization)
    removed = purge_expired_tokens()
    return {"removed": removed}


@router.delete("/users/{user_id}")
def admin_delete_user(user_id: int, authorization: str = Header(default="")):
    token_row = verify_admin_token(authorization)
    conn = get_db_connection()
    try:
        target = conn.execute(
            "SELECT subject, user_type FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target["subject"] == token_row["subject"] and target["user_type"] == token_row["user_type"]:
            raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        now = utc_now_iso()
        conn.execute(
            "UPDATE auth_tokens SET revoked_at = ? WHERE subject = ? AND user_type = ? AND revoked_at IS NULL",
            (now, target["subject"], target["user_type"]),
        )
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return {"ok": True, "deleted_id": user_id}
    finally:
        conn.close()
