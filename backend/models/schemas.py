from pydantic import BaseModel, Field


class DiagnosisIn(BaseModel):
    date: str
    diagnosis: str
    confidence: float
    location: str
    status: str
    patient_id: str | None = None
    age_group: str | None = None
    sex: str | None = None
    skin_tone: str | None = None


class DiagnosisOut(DiagnosisIn):
    id: int


class SecondOpinionPostCreate(BaseModel):
    is_anonymous: bool = False
    doctor_name: str | None = None
    doctor_affiliation: str | None = None
    patient_id: str | None = None
    current_hypothesis: str | None = None
    question_text: str
    lesion_location: str | None = None
    diagnosis: str | None = None
    age_group: str | None = None
    sex: str | None = None
    skin_tone: str | None = None
    image_urls: list[str] = Field(default_factory=list)


class SecondOpinionPostUpdate(BaseModel):
    question_text: str | None = None
    current_hypothesis: str | None = None
    status: str | None = None


class SecondOpinionCommentCreate(BaseModel):
    is_anonymous: bool = False
    author_name: str | None = None
    comment_text: str


class SecondOpinionCommentOut(BaseModel):
    id: int
    post_id: int
    created_at: str
    is_anonymous: bool
    author_name: str
    comment_text: str
    can_delete: bool = False


class SecondOpinionPostOut(BaseModel):
    id: int
    created_at: str
    updated_at: str
    status: str
    is_anonymous: bool
    doctor_name: str
    doctor_affiliation: str | None = None
    patient_id: str | None = None
    current_hypothesis: str | None = None
    question_text: str
    lesion_location: str | None = None
    diagnosis: str | None = None
    age_group: str | None = None
    sex: str | None = None
    skin_tone: str | None = None
    image_urls: list[str]
    comments: list[SecondOpinionCommentOut]
    can_delete: bool = False


class AuthLoginRequest(BaseModel):
    user_type: str
    password: str
    confirm_password: str | None = None
    doctor_id: str | None = None
    hospital: str | None = None
    email: str | None = None
    full_name: str | None = None
    phone_number: str | None = None


class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_at: str
    user_type: str
    display_name: str
    email: str | None = None
    full_name: str | None = None
    phone_number: str | None = None
    hospital: str | None = None
    doctor_id: str | None = None
    is_admin: bool = False


class AuthMeResponse(BaseModel):
    user_type: str
    display_name: str
    expires_at: str
    email: str | None = None
    full_name: str | None = None
    phone_number: str | None = None
    hospital: str | None = None
    doctor_id: str | None = None
    is_admin: bool = False


class ImageLabelCreate(BaseModel):
    image_path: str
    image_folder: str
    image_filename: str
    classification: str
    confidence_score: int


class ImageLabelOut(BaseModel):
    id: int
    image_path: str
    image_folder: str
    image_filename: str
    classification: str
    confidence_score: int
    doctor_name: str
    doctor_affiliation: str | None = None
    labeled_at: str


class MilImageInfo(BaseModel):
    folder: str
    filename: str
    path: str
