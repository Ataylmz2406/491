import logging
import sqlite3
from datetime import datetime, timezone
from config import (
    DB_PATH,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS,
)
from security import hash_password

logger = logging.getLogger("suderm")


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
                token_type TEXT NOT NULL DEFAULT 'access',
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
                email TEXT,
                full_name TEXT,
                phone_number TEXT,
                hospital TEXT,
                doctor_id TEXT,
                created_at TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0
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
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mil10k_labels_image_path ON mil10k_labels(image_path)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mil10k_labels_folder ON mil10k_labels(image_folder)"
        )
        conn.commit()
    finally:
        conn.close()

    _ensure_diagnoses_columns()
    _ensure_user_columns()
    _ensure_second_opinion_columns()
    _ensure_second_opinion_strict_constraints()
    _ensure_auth_token_columns()
    _ensure_mil10k_labels_schema()


# ---------------------------------------------------------------------------
# Schema migrations
# ---------------------------------------------------------------------------

def _ensure_diagnoses_columns() -> None:
    conn = get_db_connection()
    try:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(diagnoses)").fetchall()}
        for col, typ in {
            "patient_id": "TEXT",
            "age_group": "TEXT",
            "sex": "TEXT",
            "skin_tone": "TEXT",
            "doctor_id": "TEXT",
            "doctor_name": "TEXT",
            "prediction": "TEXT",
            "confidence_score": "REAL",
            "created_at": "TEXT",
            "lesion_location": "TEXT",
        }.items():
            if col not in columns:
                conn.execute(f"ALTER TABLE diagnoses ADD COLUMN {col} {typ}")
        conn.commit()
    finally:
        conn.close()


def _ensure_user_columns() -> None:
    conn = get_db_connection()
    try:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        for col, typ in {
            "email": "TEXT",
            "full_name": "TEXT",
            "phone_number": "TEXT",
            "doctor_id": "TEXT",
            "is_admin": "INTEGER NOT NULL DEFAULT 0",
        }.items():
            if col not in columns:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {typ}")
        conn.commit()
    finally:
        conn.close()


def _ensure_second_opinion_columns() -> None:
    conn = get_db_connection()
    try:
        post_cols = {row["name"] for row in conn.execute("PRAGMA table_info(second_opinion_posts)").fetchall()}
        for col, typ in {
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
        }.items():
            if col not in post_cols:
                conn.execute(f"ALTER TABLE second_opinion_posts ADD COLUMN {col} {typ}")

        comment_cols = {row["name"] for row in conn.execute("PRAGMA table_info(second_opinion_comments)").fetchall()}
        for col, typ in {
            "created_at": "TEXT",
            "is_anonymous": "INTEGER NOT NULL DEFAULT 0",
            "created_by_identity": "TEXT",
            "author_name": "TEXT",
            "comment_text": "TEXT",
        }.items():
            if col not in comment_cols:
                conn.execute(f"ALTER TABLE second_opinion_comments ADD COLUMN {col} {typ}")

        image_cols = {row["name"] for row in conn.execute("PRAGMA table_info(second_opinion_images)").fetchall()}
        for col, typ in {
            "sort_order": "INTEGER NOT NULL DEFAULT 0",
            "image_url": "TEXT",
        }.items():
            if col not in image_cols:
                conn.execute(f"ALTER TABLE second_opinion_images ADD COLUMN {col} {typ}")

        if "created_by_identity" in post_cols:
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
                        WHEN instr(doctor_name, '@') > 0
                            THEN substr(doctor_name, 1, instr(doctor_name, '@') - 1)
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

    return (
        "status text not null" in posts_sql
        and "check (status in ('open', 'resolved', 'archived', 'draft'))" in posts_sql
        and "is_anonymous integer not null default 0" in posts_sql
        and "check (is_anonymous in (0, 1))" in posts_sql
        and "question_text text not null" in posts_sql
        and "is_anonymous integer not null default 0" in comments_sql
        and "check (is_anonymous in (0, 1))" in comments_sql
        and "comment_text text not null" in comments_sql
        and "image_url text not null" in images_sql
        and "check (length(image_url) <= " in images_sql
        and "sort_order integer not null default 0" in images_sql
        and "check (sort_order >= 0)" in images_sql
    )


def _ensure_second_opinion_strict_constraints() -> None:
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
                    WHEN lower(trim(status)) IN ('open', 'resolved', 'archived', 'draft')
                        THEN lower(trim(status))
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
                c.id, c.post_id,
                COALESCE(NULLIF(trim(c.created_at), ''), ?),
                CASE WHEN CAST(c.is_anonymous AS INTEGER) = 1 THEN 1 ELSE 0 END,
                NULLIF(trim(c.created_by_identity), ''),
                NULLIF(trim(c.author_name), ''),
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
            SELECT
                i.id, i.post_id,
                trim(i.image_url),
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


def _ensure_auth_token_columns() -> None:
    conn = get_db_connection()
    try:
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(auth_tokens)").fetchall()}
        if "subject" not in cols:
            conn.execute("ALTER TABLE auth_tokens ADD COLUMN subject TEXT")
        if "token_type" not in cols:
            conn.execute("ALTER TABLE auth_tokens ADD COLUMN token_type TEXT NOT NULL DEFAULT 'access'")
        conn.execute(
            """
            UPDATE auth_tokens
            SET subject = lower(trim(display_name))
            WHERE (subject IS NULL OR trim(subject) = '')
              AND display_name IS NOT NULL AND trim(display_name) != ''
            """
        )
        conn.execute(
            "UPDATE auth_tokens SET token_type = 'access' WHERE token_type IS NULL OR trim(token_type) = ''"
        )
        conn.commit()
    finally:
        conn.close()


def _has_mil10k_composite_unique_constraint(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mil10k_labels'"
    ).fetchone()
    return "unique(image_path, labeled_by_identity)" in _normalize_sql(row["sql"] if row else "")


def _ensure_mil10k_labels_schema() -> None:
    conn = get_db_connection()
    try:
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(mil10k_labels)").fetchall()}
        if "labeled_by_identity" not in cols:
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
        conn.execute(
            """
            INSERT INTO mil10k_labels_new (
                image_path, image_folder, image_filename, classification,
                confidence_score, labeled_by_identity, doctor_name, doctor_affiliation, labeled_at
            )
            SELECT
                src.image_path, src.image_folder, src.image_filename, src.classification,
                src.confidence_score, src.labeled_by_identity, src.doctor_name,
                src.doctor_affiliation, src.labeled_at
            FROM mil10k_labels src
            WHERE NOT EXISTS (
                SELECT 1 FROM mil10k_labels newer
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
            "CREATE INDEX IF NOT EXISTS idx_mil10k_labels_image_path ON mil10k_labels(image_path)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mil10k_labels_folder ON mil10k_labels(image_folder)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mil10k_labels_identity ON mil10k_labels(labeled_by_identity)"
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_admin_account() -> None:
    subject = ADMIN_EMAIL.lower()
    conn = get_db_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE subject = ? AND user_type = 'personal'",
            (subject,),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE users SET is_admin = 1 WHERE subject = ? AND user_type = 'personal'",
                (subject,),
            )
            conn.commit()
            return
        conn.execute(
            """
            INSERT INTO users
              (subject, user_type, password_hash, display_name, email, full_name,
               phone_number, hospital, doctor_id, created_at, is_admin)
            VALUES (?, 'personal', ?, 'Admin', ?, 'Admin', NULL, NULL, NULL, ?, 1)
            """,
            (subject, hash_password(ADMIN_PASSWORD), ADMIN_EMAIL, utc_now_iso()),
        )
        conn.commit()
        logger.info("Admin account created: %s", subject)
    finally:
        conn.close()
