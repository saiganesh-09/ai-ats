"""SQLAlchemy ORM models — one class per table.

Schema design notes:
- `applications` is a many-to-many join table between users and jobs that
  carries its own data (status, match_score, which resume was used). The
  UniqueConstraint enforces "one application per candidate per job".
- `resumes.parsed` is JSONB: the AI returns semi-structured data whose shape
  can evolve, so a document column beats 10 rigid columns. Postgres can still
  index/query inside JSONB later if needed.
"""
import enum
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, enum.Enum):
    recruiter = "recruiter"
    candidate = "candidate"


class JobStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    screening = "screening"
    interview = "interview"
    offer = "offer"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    full_name: Mapped[str]
    hashed_password: Mapped[str]
    role: Mapped[UserRole]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    jobs: Mapped[list["Job"]] = relationship(back_populates="recruiter")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="candidate")
    applications: Mapped[list["Application"]] = relationship(back_populates="candidate")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str]
    company: Mapped[str]
    location: Mapped[str | None]
    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[str | None] = mapped_column(Text)
    status: Mapped[JobStatus] = mapped_column(default=JobStatus.open)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    recruiter: Mapped[User] = relationship(back_populates="jobs")
    applications: Mapped[list["Application"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    original_filename: Mapped[str]
    file_path: Mapped[str]
    raw_text: Mapped[str] = mapped_column(Text)
    parsed: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    candidate: Mapped[User] = relationship(back_populates="resumes")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"))
    cover_note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ApplicationStatus] = mapped_column(default=ApplicationStatus.applied)
    match_score: Mapped[float | None] = mapped_column(Float)
    match_details: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    job: Mapped[Job] = relationship(back_populates="applications")
    candidate: Mapped[User] = relationship(back_populates="applications")
    resume: Mapped[Resume] = relationship()
