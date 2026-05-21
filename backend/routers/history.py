from fastapi import APIRouter, Header, HTTPException, Query
from database import get_db_connection, utc_now_iso
from dependencies import verify_doctor_token, doctor_scope_values
from models.schemas import DiagnosisIn, DiagnosisOut

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[DiagnosisOut])
def get_history(patient_id: str | None = None, authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    doctor_id, doctor_name = doctor_scope_values(token_row)
    conn = get_db_connection()
    try:
        if patient_id:
            rows = conn.execute(
                """
                SELECT id, date, diagnosis, confidence, location, status,
                       patient_id, age_group, sex, skin_tone
                FROM diagnoses
                WHERE patient_id = ? AND (doctor_id = ? OR doctor_name = ?)
                ORDER BY datetime(date) DESC, id DESC
                """,
                (patient_id, doctor_id, doctor_name),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, date, diagnosis, confidence, location, status,
                       patient_id, age_group, sex, skin_tone
                FROM diagnoses
                WHERE doctor_id = ? OR doctor_name = ?
                ORDER BY datetime(date) DESC, id DESC
                """,
                (doctor_id, doctor_name),
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@router.post("", response_model=DiagnosisOut)
def create_history_item(payload: DiagnosisIn, authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    doctor_id, doctor_name = doctor_scope_values(token_row)
    conn = get_db_connection()
    try:
        now = utc_now_iso()
        cursor = conn.execute(
            """
            INSERT INTO diagnoses (
                date, diagnosis, confidence, location, status,
                patient_id, age_group, sex, skin_tone, doctor_id, doctor_name,
                prediction, confidence_score, created_at, lesion_location
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            """,
            (
                payload.date, payload.diagnosis, payload.confidence, payload.location, payload.status,
                payload.patient_id, payload.age_group, payload.sex, payload.skin_tone,
                doctor_id, doctor_name, payload.diagnosis, payload.confidence, now, payload.location,
            ),
        )
        new_id = cursor.fetchone()["id"]
        conn.commit()
        row = conn.execute(
            """
            SELECT id, date, diagnosis, confidence, location, status,
                   patient_id, age_group, sex, skin_tone
            FROM diagnoses WHERE id = ?
            """,
            (new_id,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.delete("/{diagnosis_id}")
def delete_history_item(diagnosis_id: int, authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    doctor_id, doctor_name = doctor_scope_values(token_row)
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM diagnoses WHERE id = ? AND (doctor_id = ? OR doctor_name = ?)",
            (diagnosis_id, doctor_id, doctor_name),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
        return {"ok": True}
    finally:
        conn.close()


@router.delete("")
def delete_all_history(authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    doctor_id, doctor_name = doctor_scope_values(token_row)
    conn = get_db_connection()
    try:
        conn.execute(
            "DELETE FROM diagnoses WHERE doctor_id = ? OR doctor_name = ?",
            (doctor_id, doctor_name),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
