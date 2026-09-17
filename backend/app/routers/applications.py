"""Application routes: apply, track own applications, recruiter review + AI scoring."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..deps import CurrentUser, DB
from ..models import Application, Job, JobStatus, Resume, UserRole
from ..schemas import ApplicationIn, ApplicationOut, MatchResultOut, StatusUpdate
from ..services import ai_service

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def apply(body: ApplicationIn, db: DB, user: CurrentUser):
    if user.role != UserRole.candidate:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Candidates only")

    job = db.get(Job, body.job_id)
    if job is None or job.status != JobStatus.open:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not available")

    resume = db.get(Resume, body.resume_id)
    # Ownership check: candidates can only apply with their own resume.
    if resume is None or resume.candidate_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")

    application = Application(
        job_id=job.id, candidate_id=user.id, resume_id=resume.id,
        cover_note=body.cover_note,
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Already applied to this job")
    db.refresh(application)
    return application


@router.get("/mine", response_model=list[ApplicationOut])
def my_applications(db: DB, user: CurrentUser):
    stmt = (
        select(Application)
        .where(Application.candidate_id == user.id)
        .order_by(Application.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.patch("/{application_id}/status", response_model=ApplicationOut)
def update_status(application_id: int, body: StatusUpdate, db: DB, recruiter: CurrentUser):
    application = _recruiter_application(application_id, db, recruiter)
    application.status = body.status
    db.commit()
    db.refresh(application)
    return application


@router.post("/{application_id}/score", response_model=MatchResultOut)
def score_application(application_id: int, db: DB, recruiter: CurrentUser):
    """Run the AI matcher and persist the result on the application."""
    application = _recruiter_application(application_id, db, recruiter)
    result = ai_service.score_match(
        application.resume.parsed or {"raw_text": application.resume.raw_text[:4000]},
        application.job.title,
        application.job.description,
        application.job.requirements,
    )
    application.match_score = float(result.get("score", 0))
    application.match_details = result
    db.commit()
    return result


def _recruiter_application(application_id: int, db: DB, recruiter) -> Application:
    """Load an application, enforcing that the recruiter owns its job."""
    if recruiter.role != UserRole.recruiter:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recruiters only")
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if application.job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your job posting")
    return application
