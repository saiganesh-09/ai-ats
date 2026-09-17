# Interview Talking Points

Use these to explain the project. Each is phrased as "what" + "why" — that's
what interviewers probe for.

## The 60-second pitch

> "I built a full-stack AI applicant tracking system. Recruiters post jobs,
> candidates upload resumes which get parsed by an LLM into structured profiles,
> and each application gets an AI match score with matched/missing skills.
> It's a React/TypeScript frontend, FastAPI backend, PostgreSQL with Alembic
> migrations, JWT auth with role-based access, and the AI layer has a mock
> fallback so it degrades gracefully without an API key."

## Questions you'll get + good answers

**"Why FastAPI over Flask/Django?"**
Async-first, type-hint-driven validation via Pydantic, and it generates OpenAPI
docs automatically — the API is self-documenting at `/docs`.

**"How does auth work?"**
JWT bearer tokens. Login returns a signed token with the user id + role.
Every protected route decodes it through a FastAPI dependency, loads the user
from Postgres, and a `require_role` dependency enforces recruiter vs candidate.
Passwords are hashed with argon2id — memory-hard, so brute-force is expensive.

**"Why JWT instead of sessions?"**
Stateless — no session table or Redis needed, scales horizontally. Trade-off I
know: tokens can't be revoked before expiry without a blocklist, and
localStorage storage is XSS-exposed — production would use httpOnly cookies.

**"Walk me through the database."**
Four tables. `applications` is the interesting one — a many-to-many join
between users and jobs carrying its own state (pipeline status, AI score,
resume used). Unique constraint on (job_id, candidate_id) prevents duplicate
applications at the DB level. AI output goes in JSONB columns because it's
semi-structured; everything else is normalized.

**"How does the AI part work?"**
Two functions behind a service module: `parse_resume` turns PDF text into
structured JSON (skills/experience/education), `score_match` compares a parsed
resume to a job and returns score + matched/missing skills + explanation. Both
use OpenAI's JSON mode with strict prompts. If there's no API key or the call
fails, a deterministic keyword-matching mock runs instead — the AI is an
enhancement, not a hard dependency.

**"How would you scale it?"**
- Resume parsing/scoring → background queue (Celery/ARQ) — right now it's
  synchronous in the request, which blocks for a second or two
- Files → S3 instead of local disk
- Matching at scale → embeddings + pgvector for semantic search instead of
  per-request LLM calls (cheaper, enables "find similar candidates")
- Rate limiting + caching job listings

**"What would you add with more time?"**
Tests (pytest + httpx for the API), email notifications on status change,
candidate-facing score feedback, interview scheduling, full-text search on
resumes via Postgres `tsvector`.

## Concepts this project demonstrates

- REST API design (resource-oriented, proper status codes)
- ORM + migrations (SQLAlchemy 2.0 typed models, Alembic)
- Role-based access control enforced server-side
- LLM integration: prompt engineering, structured JSON output, fallback strategy
- React: Context for auth state, protected routes, controlled forms
- TypeScript contracts shared conceptually with Pydantic schemas
