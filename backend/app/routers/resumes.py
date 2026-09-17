"""Resume routes: upload -> extract text -> AI parse -> store."""
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import select

from ..config import settings
from ..deps import CurrentUser, DB
from ..models import Resume, UserRole
from ..schemas import ResumeOut
from ..services import ai_service, resume_parser

router = APIRouter(prefix="/resumes", tags=["resumes"])

MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(file: UploadFile, db: DB, user: CurrentUser):
    if user.role != UserRole.candidate:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Candidates only")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")

    try:
        raw_text = resume_parser.extract_text(file.filename or "resume.txt", content)
    except resume_parser.UnsupportedFileError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    # Store file with a random name — never trust user-supplied filenames.
    ext = Path(file.filename or "resume.txt").suffix or ".txt"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(exist_ok=True)
    stored_name = f"{uuid.uuid4()}{ext}"
    (upload_dir / stored_name).write_bytes(content)

    parsed = ai_service.parse_resume(raw_text)

    resume = Resume(
        candidate_id=user.id,
        original_filename=file.filename or "resume.txt",
        file_path=str(upload_dir / stored_name),
        raw_text=raw_text,
        parsed=parsed,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.get("/mine", response_model=list[ResumeOut])
def my_resumes(db: DB, user: CurrentUser):
    stmt = select(Resume).where(Resume.candidate_id == user.id).order_by(Resume.created_at.desc())
    return db.scalars(stmt).all()
