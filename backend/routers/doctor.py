from fastapi import APIRouter, Form, Header, HTTPException
from database import get_db_connection, utc_now_iso
from dependencies import verify_doctor_token, clean_optional_text

router = APIRouter(prefix="/doctor", tags=["doctor"])


@router.post("/save-analysis")
def save_doctor_analysis(
    authorization: str = Header(default=""),
    patient_id: str = Form(None),
    prediction: str = Form(None),
    diagnosis: str = Form(None),
    confidence_score: float = Form(None),
    lesion_location: str = Form(None),
    age_group: str = Form(None),
    sex: str = Form(None),
    skin_tone: str = Form(None),
):
    token_row = verify_doctor_token(authorization)
    clean_patient_id = clean_optional_text(patient_id, 120)
    clean_prediction = clean_optional_text(prediction, 120) or clean_optional_text(diagnosis, 120)
    clean_lesion_location = clean_optional_text(lesion_location, 120)

    missing = []
    if not clean_prediction:
        missing.append("prediction")
    if confidence_score is None:
        missing.append("confidence_score")
    if not clean_lesion_location:
        missing.append("lesion_location")
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required analysis field(s): {', '.join(missing)}",
        )

    conn = get_db_connection()
    try:
        doctor_id = token_row["subject"] or token_row["display_name"]
        doctor_name = token_row["display_name"]
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
                now, clean_prediction, confidence_score, clean_lesion_location, "completed",
                clean_patient_id, age_group, sex, skin_tone, doctor_id, doctor_name,
                clean_prediction, confidence_score, now, clean_lesion_location,
            ),
        )
        new_id = cursor.fetchone()["id"]
        conn.commit()
        return {
            "id": new_id,
            "date": now,
            "prediction": clean_prediction,
            "confidence_score": confidence_score,
            "patient_id": clean_patient_id,
            "lesion_location": clean_lesion_location,
        }
    finally:
        conn.close()


@router.get("/analyses")
def get_doctor_analyses(authorization: str = Header(default="")):
    token_row = verify_doctor_token(authorization)
    conn = get_db_connection()
    try:
        doctor_id = token_row["subject"] or token_row["display_name"]
        rows = conn.execute(
            """
            SELECT
                id, date,
                COALESCE(prediction, diagnosis) as prediction,
                COALESCE(confidence_score, confidence) as confidence_score,
                COALESCE(lesion_location, location) as lesion_location,
                status, patient_id, age_group, sex, skin_tone, doctor_id, doctor_name,
                COALESCE(created_at, date) as created_at
            FROM diagnoses
            WHERE doctor_id = ? OR doctor_name = ?
            ORDER BY date DESC, id DESC
            LIMIT 1000
            """,
            (doctor_id, token_row["display_name"]),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "date": r["date"],
                "created_at": r["created_at"],
                "prediction": r["prediction"],
                "confidence_score": r["confidence_score"],
                "lesion_location": r["lesion_location"],
                "patient_id": r["patient_id"],
                "age_group": r["age_group"],
                "sex": r["sex"],
                "skin_tone": r["skin_tone"],
                "status": r["status"],
            }
            for r in rows
        ]
    finally:
        conn.close()
