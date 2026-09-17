# AI ATS — AI-Powered Applicant Tracking System

A full-stack ATS where recruiters post jobs and candidates apply with resumes.
AI (OpenAI) parses resumes into structured profiles and scores each applicant
against the job description.

## Stack

| Layer      | Technology                          | Why |
|------------|-------------------------------------|-----|
| Frontend   | React 19 + TypeScript + Vite        | Type-safe SPA, fast dev server |
| Styling    | Tailwind CSS v4                     | Utility-first, no custom CSS files |
| Backend    | FastAPI (Python 3.12)               | Async, auto OpenAPI docs, Pydantic validation |
| ORM        | SQLAlchemy 2.0 + Alembic            | Industry-standard ORM + versioned migrations |
| Database   | PostgreSQL 16                       | Relational data, JSONB for AI output |
| Auth       | JWT (PyJWT) + argon2 (pwdlib)       | Stateless sessions, modern password hashing |
| AI         | OpenAI API (`gpt-4o-mini`)          | Resume parsing + match scoring, JSON mode |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system diagrams and
[docs/DATABASE.md](docs/DATABASE.md) for the schema ERD.
[docs/INTERVIEW.md](docs/INTERVIEW.md) has talking points for explaining this project.

## Quick start

```bash
# 1. Database (one time)
psql postgres -c "CREATE USER ats_user WITH PASSWORD 'ats_dev_password';"
psql postgres -c "CREATE DATABASE ai_ats OWNER ats_user;"

# 2. Backend
cd backend
uv venv && uv pip install -r requirements.txt   # or: python -m venv .venv && pip install -r requirements.txt
cp .env.example .env                            # add OPENAI_API_KEY if you have one
uv run --no-project alembic upgrade head
uv run --no-project uvicorn app.main:app --reload   # http://localhost:8000/docs

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                                     # http://localhost:5173
```

No OpenAI key? The app runs in **mock AI mode** — deterministic keyword matching,
no API calls, no cost. Set `OPENAI_API_KEY` in `backend/.env` to switch to real AI.

## Demo flow

1. Register as **recruiter** → post a job.
2. Register as **candidate** → upload a resume (PDF/TXT) → it gets AI-parsed.
3. Apply to the job with that resume.
4. Back as the **recruiter** → open the job → click **Score** → see the AI
   match %, matched/missing skills, and explanation → move the applicant
   through the pipeline statuses.

## Project layout

```
backend/app/
├── main.py            # FastAPI app, CORS, router wiring
├── config.py          # env settings (pydantic-settings)
├── database.py        # SQLAlchemy engine + session
├── models.py          # ORM models (the schema)
├── schemas.py         # Pydantic request/response contracts
├── security.py        # argon2 hashing + JWT
├── deps.py            # get_db, get_current_user, require_role
├── routers/           # auth, jobs, resumes, applications
└── services/          # resume_parser (PDF→text), ai_service (OpenAI+mock)
frontend/src/
├── api.ts             # typed fetch client, JWT injection
├── auth.tsx           # AuthContext + ProtectedRoute
├── types.ts           # API contract types
├── pages/             # JobBoard, JobDetail, Resumes, MyApplications, recruiter/*
└── components/        # Navbar, badges
```
