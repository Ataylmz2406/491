import os
import sqlite3
from datetime import datetime, timezone

from models import SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "suderm.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
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
            "CREATE INDEX IF NOT EXISTS idx_diagnoses_patient_date ON diagnoses(patient_id, date DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_second_op_posts_status_created ON second_opinion_posts(status, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_second_op_comments_post_created ON second_opinion_comments(post_id, created_at ASC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_second_op_images_post_sort ON second_opinion_images(post_id, sort_order ASC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens(expires_at)"
        )
        conn.commit()
    finally:
        conn.close()

    ensure_schema_columns()
    ensure_second_opinion_schema_columns()
    ensure_second_opinion_strict_constraints()
    ensure_auth_token_schema_columns()


def ensure_schema_columns() -> None:
    """Adds newly introduced optional columns for older SQLite files."""
    conn = get_db_connection()
    try:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(diagnoses)").fetchall()}
        for col, col_type in {"patient_id": "TEXT", "age_group": "TEXT", "sex": "TEXT", "skin_tone": "TEXT"}.items():
            if col not in columns:
                conn.execute(f"ALTER TABLE diagnoses ADD COLUMN {col} {col_type}")
        conn.commit()
    finally:
        conn.close()


def ensure_second_opinion_schema_columns() -> None:
    """Adds missing second-opinion columns for older SQLite files."""
    conn = get_db_connection()
    try:
        post_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(second_opinion_posts)").fetchall()
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
        for col, col_type in post_migrations.items():
            if col not in post_columns:
                conn.execute(f"ALTER TABLE second_opinion_posts ADD COLUMN {col} {col_type}")

        comment_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(second_opinion_comments)").fetchall()
        }
        for col, col_type in {
            "created_at": "TEXT",
            "is_anonymous": "INTEGER NOT NULL DEFAULT 0",
            "created_by_identity": "TEXT",
            "author_name": "TEXT",
            "comment_text": "TEXT",
        }.items():
            if col not in comment_columns:
                conn.execute(f"ALTER TABLE second_opinion_comments ADD COLUMN {col} {col_type}")

        image_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(second_opinion_images)").fetchall()
        }
        for col, col_type in {"sort_order": "INTEGER NOT NULL DEFAULT 0", "image_url": "TEXT"}.items():
            if col not in image_columns:
                conn.execute(f"ALTER TABLE second_opinion_images ADD COLUMN {col} {col_type}")

        if "created_by_identity" in post_columns:
            conn.execute(
                """
                UPDATE second_opinion_posts
                SET created_by_identity = 'doctor:' || lower(trim(doctor_name))
                WHERE (created_by_identity IS NULL OR trim(created_by_identity) = '')
                  AND doctor_name IS NOT NULL AND trim(doctor_name) != ''
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
                WHERE doctor_name IS NOT NULL AND trim(doctor_name) != ''
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
        SELECT name, sql FROM sqlite_master
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


def ensure_second_opinion_strict_constraints() -> None:
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
                CASE WHEN lower(trim(status)) IN ('open', 'resolved', 'archived', 'draft') THEN lower(trim(status)) ELSE 'open' END,
                CASE WHEN CAST(is_anonymous AS INTEGER) = 1 THEN 1 ELSE 0 END,
                NULLIF(trim(created_by_identity), ''), NULLIF(trim(doctor_name), ''),
                NULLIF(trim(doctor_affiliation), ''), NULLIF(trim(patient_id), ''),
                NULLIF(trim(current_hypothesis), ''),
                COALESCE(NULLIF(trim(question_text), ''), 'Second opinion request'),
                NULLIF(trim(lesion_location), ''), NULLIF(trim(diagnosis), ''),
                NULLIF(trim(age_group), ''), NULLIF(trim(sex), ''), NULLIF(trim(skin_tone), '')
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
            SELECT c.id, c.post_id,
                COALESCE(NULLIF(trim(c.created_at), ''), ?),
                CASE WHEN CAST(c.is_anonymous AS INTEGER) = 1 THEN 1 ELSE 0 END,
                NULLIF(trim(c.created_by_identity), ''), NULLIF(trim(c.author_name), ''),
                COALESCE(NULLIF(trim(c.comment_text), ''), 'No comment')
            FROM second_opinion_comments c
            WHERE c.post_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM second_opinion_posts_new p WHERE p.id = c.post_id)
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
            SELECT i.id, i.post_id, trim(i.image_url),
                CASE WHEN CAST(i.sort_order AS INTEGER) >= 0 THEN CAST(i.sort_order AS INTEGER) ELSE 0 END
            FROM second_opinion_images i
            WHERE i.post_id IS NOT NULL
              AND NULLIF(trim(i.image_url), '') IS NOT NULL
              AND length(trim(i.image_url)) <= ?
              AND EXISTS (SELECT 1 FROM second_opinion_posts_new p WHERE p.id = i.post_id)
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
            "CREATE INDEX IF NOT EXISTS idx_second_op_posts_status_created ON second_opinion_posts(status, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_second_op_comments_post_created ON second_opinion_comments(post_id, created_at ASC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_second_op_images_post_sort ON second_opinion_images(post_id, sort_order ASC)"
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.close()


def ensure_auth_token_schema_columns() -> None:
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
              AND display_name IS NOT NULL AND trim(display_name) != ''
            """
        )
        conn.commit()
    finally:
        conn.close()
