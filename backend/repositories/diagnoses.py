from fastapi import HTTPException

from database import get_db_connection
from models import DiagnosisIn

_SELECT_COLS = "id, date, diagnosis, confidence, location, status, patient_id, age_group, sex, skin_tone"


def get_history(patient_id: str | None) -> list[dict]:
    conn = get_db_connection()
    try:
        if patient_id:
            rows = conn.execute(
                f"SELECT {_SELECT_COLS} FROM diagnoses WHERE patient_id = ? ORDER BY datetime(date) DESC, id DESC",
                (patient_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                f"SELECT {_SELECT_COLS} FROM diagnoses ORDER BY datetime(date) DESC, id DESC"
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def create_diagnosis(payload: DiagnosisIn) -> dict:
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            """
            INSERT INTO diagnoses (date, diagnosis, confidence, location, status,
                                   patient_id, age_group, sex, skin_tone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.date, payload.diagnosis, payload.confidence,
                payload.location, payload.status, payload.patient_id,
                payload.age_group, payload.sex, payload.skin_tone,
            ),
        )
        conn.commit()
        row = conn.execute(
            f"SELECT {_SELECT_COLS} FROM diagnoses WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


def delete_diagnosis(diagnosis_id: int) -> None:
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM diagnoses WHERE id = ?", (diagnosis_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
    finally:
        conn.close()


def delete_all_diagnoses() -> None:
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM diagnoses")
        conn.commit()
    finally:
        conn.close()
