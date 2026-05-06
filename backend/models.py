from pydantic import BaseModel, Field

SECOND_OPINION_ALLOWED_STATUSES = {"open", "resolved", "archived", "draft"}
SECOND_OPINION_MAX_IMAGES = 12
SECOND_OPINION_ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
SECOND_OPINION_MAX_IMAGE_BYTES = 2 * 1024 * 1024
SECOND_OPINION_MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024
SECOND_OPINION_MAX_IMAGE_DATA_URL_CHARS = 3_000_000
SECOND_OPINION_POST_MAX_REQUEST_BYTES = 12 * 1024 * 1024
SECOND_OPINION_MAX_QUESTION_LEN = 4000
SECOND_OPINION_MAX_COMMENT_LEN = 2000
AUTH_TOKEN_TTL_HOURS = 24
AUTH_ALLOWED_USER_TYPES = {"doctor", "researcher", "personal"}


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


class AuthLoginRequest(BaseModel):
    user_type: str
    password: str
    doctor_id: str | None = None
    hospital: str | None = None
    email: str | None = None


class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_at: str
    user_type: str
    display_name: str


class AuthMeResponse(BaseModel):
    user_type: str
    display_name: str
    expires_at: str
