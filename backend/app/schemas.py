"""Pydantic schemas — the API's request/response contracts.

Why separate from models.py: the DB shape and the API shape evolve
independently. E.g. `UserOut` deliberately omits `hashed_password` so it can
never leak in a response, even by accident.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- auth / users ----------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=120)
    role: Literal["recruiter", "candidate"] = "candidate"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- jobs ----------

class JobIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    location: str | None = None
    description: str = Field(min_length=20)
    requirements: str | None = None


class JobUpdate(BaseModel):
    title: str | None = None
    company: str | None = None
    location: str | None = None
    description: str | None = None
    requirements: str | None = None
    status: Literal["open", "closed"] | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str
    location: str | None
    description: str
    requirements: str | None
    status: str
    created_at: datetime


# ---------- resumes ----------

class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    parsed: dict | None
    created_at: datetime


# ---------- applications ----------

class ApplicationIn(BaseModel):
    job_id: int
    resume_id: int
    cover_note: str | None = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    resume_id: int
    status: str
    cover_note: str | None
    match_score: float | None
    match_details: dict | None
    created_at: datetime
    job: JobOut


class StatusUpdate(BaseModel):
    status: Literal["applied", "screening", "interview", "offer", "rejected"]


class ApplicantOut(BaseModel):
    """Recruiter's pipeline view: application + who the candidate is."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    cover_note: str | None
    match_score: float | None
    match_details: dict | None
    created_at: datetime
    candidate: UserOut
    resume: ResumeOut


class MatchResultOut(BaseModel):
    score: float
    matched_skills: list[str]
    missing_skills: list[str]
    explanation: str
