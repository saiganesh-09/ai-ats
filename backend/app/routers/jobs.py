"""Job routes: public browsing + recruiter CRUD + applicant pipeline."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DB, require_role
from ..models import Application, Job, JobStatus, UserRole
from ..schemas import ApplicantOut, JobIn, JobOut, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])

Recruiter = Depends(require_role(UserRole.recruiter))


@router.get("", response_model=list[JobOut])
def list_jobs(db: DB, q: str | None = None):
    """Public job board — only open positions. Optional title/company search."""
    stmt = select(Job).where(Job.status == JobStatus.open).order_by(Job.created_at.desc())
    if q:
        stmt = stmt.where(Job.title.ilike(f"%{q}%") | Job.company.ilike(f"%{q}%"))
    return db.scalars(stmt).all()


@router.get("/mine", response_model=list[JobOut])
def my_jobs(db: DB, recruiter: CurrentUser):
    """Recruiter's own postings (open and closed)."""
    _check_recruiter(recruiter)
    stmt = select(Job).where(Job.recruiter_id == recruiter.id).order_by(Job.created_at.desc())
    return db.scalars(stmt).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: DB):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(body: JobIn, db: DB, recruiter: CurrentUser):
    _check_recruiter(recruiter)
    job = Job(recruiter_id=recruiter.id, **body.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.patch("/{job_id}", response_model=JobOut)
def update_job(job_id: int, body: JobUpdate, db: DB, recruiter: CurrentUser):
    job = _owned_job(job_id, db, recruiter)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, db: DB, recruiter: CurrentUser):
    job = _owned_job(job_id, db, recruiter)
    db.delete(job)
    db.commit()


@router.get("/{job_id}/applications", response_model=list[ApplicantOut])
def job_applications(job_id: int, db: DB, recruiter: CurrentUser):
    """Recruiter pipeline view — every applicant for this job, best matches first."""
    _owned_job(job_id, db, recruiter)
    stmt = (
        select(Application)
        .where(Application.job_id == job_id)
        .order_by(Application.match_score.desc().nullslast(), Application.created_at)
    )
    return db.scalars(stmt).all()


def _check_recruiter(user):
    if user.role != UserRole.recruiter:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recruiters only")


def _owned_job(job_id: int, db: DB, recruiter) -> Job:
    """Load a job and enforce ownership — recruiters only touch their own jobs."""
    _check_recruiter(recruiter)
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your job posting")
    return job
