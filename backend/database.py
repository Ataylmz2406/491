import logging
import os
import re
import sqlite3

from datetime import datetime, timezone

from config import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    BASE_DIR,
    DATABASE_URL,
    SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS,
)
from security import hash_password

logger = logging.getLogger("suderm")


class DbRow(dict):
    """Mapping row that also supports sqlite-style integer indexing."""

    def __init__(self, mapping):
        super().__init__(mapping)
        self._values = list(mapping.values())

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


class DbCursor:
    """Wraps database cursors behind the subset used by the routers."""

    def __init__(self, cursor):
        self._c = cursor

    @staticmethod
    def _wrap(row):
        if row is None:
            return None
        if isinstance(row, DbRow):
            return row
        if isinstance(row, sqlite3.Row):
            return DbRow({key: row[key] for key in row.keys()})
        if isinstance(row, dict):
            return DbRow(row)
        return row

    def fetchone(self):
        return self._wrap(self._c.fetchone())

    def fetchall(self):
        return [self._wrap(row) for row in self._c.fetchall()]

    @property
    def rowcount(self) -> int:
        return self._c.rowcount


class NoopCursor:
    rowcount = 0

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class DbConn:
    """Wraps a psycopg2 connection to match sqlite3's connection interface.

    Automatically replaces ? placeholders with %s so existing SQL strings
    work with PostgreSQL without modification.
    """

    def __init__(self, dsn: str):
        import psycopg2
        import psycopg2.extras

        self._conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)

    def execute(self, sql: str, params=()) -> DbCursor:
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.execute(sql, params if params else None)
        return DbCursor(cur)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


class SqliteConn:
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._conn = sqlite3.connect(db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")

    def execute(self, sql: str, params=()) -> DbCursor | NoopCursor:
        sql = self._prepare_sql(sql)
        if sql is None:
            return NoopCursor()
        cur = self._conn.cursor()
        cur.execute(sql, params if params else ())
        return DbCursor(cur)

    def _prepare_sql(self, sql: str) -> str | None:
        alter_match = re.match(
            r"^\s*ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+(.+?)\s*$",
            sql,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if alter_match:
            table, column, column_type = alter_match.groups()
            existing = {
                row["name"]
                for row in self._conn.execute(f"PRAGMA table_info({table})").fetchall()
            }
            if column in existing:
                return None
            sql = f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"

        sql = re.sub(
            r"\bSERIAL\s+PRIMARY\s+KEY\b",
            "INTEGER PRIMARY KEY AUTOINCREMENT",
            sql,
            flags=re.IGNORECASE,
        )
        sql = re.sub(r"\bDOUBLE\s+PRECISION\b", "REAL", sql, flags=re.IGNORECASE)
        return sql

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def _sqlite_path_from_url(database_url: str) -> str:
    path = database_url.removeprefix("sqlite:///")
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    return os.path.abspath(path)


def get_db_connection():
    if DATABASE_URL.startswith("sqlite:///"):
        return SqliteConn(_sqlite_path_from_url(DATABASE_URL))
    return DbConn(DATABASE_URL)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Schema creation
# ---------------------------------------------------------------------------

def init_db() -> None:
    conn = get_db_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnoses (
                id                SERIAL PRIMARY KEY,
                date              TEXT NOT NULL,
                diagnosis         TEXT NOT NULL,
                confidence        DOUBLE PRECISION NOT NULL,
                location          TEXT NOT NULL,
                status            TEXT NOT NULL,
                patient_id        TEXT,
                age_group         TEXT,
                sex               TEXT,
                skin_tone         TEXT,
                doctor_id         TEXT,
                doctor_name       TEXT,
                prediction        TEXT,
                confidence_score  DOUBLE PRECISION,
                created_at        TEXT,
                lesion_location   TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS second_opinion_posts (
                id                   SERIAL PRIMARY KEY,
                created_at           TEXT NOT NULL,
                updated_at           TEXT NOT NULL,
                status               TEXT NOT NULL DEFAULT 'open'
                                         CHECK (status IN ('open', 'resolved', 'archived', 'draft')),
                is_anonymous         INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
                created_by_identity  TEXT,
                doctor_name          TEXT,
                doctor_affiliation   TEXT,
                patient_id           TEXT,
                current_hypothesis   TEXT,
                question_text        TEXT NOT NULL,
                lesion_location      TEXT,
                diagnosis            TEXT,
                age_group            TEXT,
                sex                  TEXT,
                skin_tone            TEXT
            )
            """
        )
        conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS second_opinion_images (
                id          SERIAL PRIMARY KEY,
                post_id     INTEGER NOT NULL,
                image_url   TEXT NOT NULL CHECK (length(image_url) <= {SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS}),
                sort_order  INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
                FOREIGN KEY (post_id) REFERENCES second_opinion_posts(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS second_opinion_comments (
                id                   SERIAL PRIMARY KEY,
                post_id              INTEGER NOT NULL,
                created_at           TEXT NOT NULL,
                is_anonymous         INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
                created_by_identity  TEXT,
                author_name          TEXT,
                comment_text         TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES second_opinion_posts(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id            SERIAL PRIMARY KEY,
                token_hash    TEXT NOT NULL UNIQUE,
                token_type    TEXT NOT NULL DEFAULT 'access',
                user_type     TEXT NOT NULL,
                subject       TEXT NOT NULL,
                display_name  TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                expires_at    TEXT NOT NULL,
                revoked_at    TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id             SERIAL PRIMARY KEY,
                subject        TEXT NOT NULL UNIQUE,
                user_type      TEXT NOT NULL,
                password_hash  TEXT NOT NULL,
                display_name   TEXT NOT NULL,
                email          TEXT,
                full_name      TEXT,
                phone_number   TEXT,
                hospital       TEXT,
                doctor_id      TEXT,
                created_at     TEXT NOT NULL,
                is_admin       INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mil10k_labels (
                id                   SERIAL PRIMARY KEY,
                image_path           TEXT NOT NULL,
                image_folder         TEXT NOT NULL,
                image_filename       TEXT NOT NULL,
                classification       TEXT NOT NULL,
                confidence_score     INTEGER NOT NULL,
                labeled_by_identity  TEXT NOT NULL,
                doctor_name          TEXT,
                doctor_affiliation   TEXT,
                labeled_at           TEXT NOT NULL,
                UNIQUE (image_path, labeled_by_identity)
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
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mil10k_labels_identity ON mil10k_labels(labeled_by_identity)"
        )
        conn.commit()
    finally:
        conn.close()

    _ensure_diagnoses_columns()
    _ensure_user_columns()
    _ensure_second_opinion_columns()
    _ensure_auth_token_columns()
    _ensure_mil10k_labels_columns()


# ---------------------------------------------------------------------------
# Schema migrations — safe to run on every startup
# ---------------------------------------------------------------------------

def _add_columns_if_missing(table: str, columns: dict[str, str]) -> None:
    conn = get_db_connection()
    try:
        for col, typ in columns.items():
            conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {typ}")
        conn.commit()
    finally:
        conn.close()


def _ensure_diagnoses_columns() -> None:
    _add_columns_if_missing("diagnoses", {
        "doctor_id": "TEXT",
        "doctor_name": "TEXT",
        "prediction": "TEXT",
        "confidence_score": "DOUBLE PRECISION",
        "created_at": "TEXT",
        "lesion_location": "TEXT",
    })


def _ensure_user_columns() -> None:
    _add_columns_if_missing("users", {
        "email": "TEXT",
        "full_name": "TEXT",
        "phone_number": "TEXT",
        "doctor_id": "TEXT",
        "is_admin": "INTEGER NOT NULL DEFAULT 0",
    })


def _ensure_second_opinion_columns() -> None:
    _add_columns_if_missing("second_opinion_posts", {
        "created_by_identity": "TEXT",
        "doctor_affiliation": "TEXT",
        "current_hypothesis": "TEXT",
        "lesion_location": "TEXT",
        "diagnosis": "TEXT",
        "age_group": "TEXT",
        "sex": "TEXT",
        "skin_tone": "TEXT",
    })
    _add_columns_if_missing("second_opinion_comments", {
        "created_by_identity": "TEXT",
        "author_name": "TEXT",
    })


def _ensure_auth_token_columns() -> None:
    _add_columns_if_missing("auth_tokens", {
        "subject": "TEXT",
        "token_type": "TEXT NOT NULL DEFAULT 'access'",
    })


def _ensure_mil10k_labels_columns() -> None:
    _add_columns_if_missing("mil10k_labels", {
        "labeled_by_identity": "TEXT",
        "doctor_affiliation": "TEXT",
    })
    conn = get_db_connection()
    try:
        conn.execute(
            """
            UPDATE mil10k_labels
            SET labeled_by_identity = 'legacy:unknown'
            WHERE labeled_by_identity IS NULL OR trim(labeled_by_identity) = ''
            """
        )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Admin bootstrap
# ---------------------------------------------------------------------------

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
