# Development Process

The project was built incrementally — the git history shows each phase
landing as a tested commit before the next started. Here's how the spec's 14
phases map to what was actually built, in order.

## Phase 1 — Project Setup
`27af83b` · Repo scaffold: `frontend/` (Next.js + Tailwind + shadcn/ui),
`backend/` (NestJS + Prisma), PostgreSQL via Homebrew, `docker-compose.yml`,
`.env.example` for both apps. NestJS chosen over Express for enforced
module/DI/guard architecture.

## Phase 2 — Authentication
Registration, login, logout, argon2id hashing, 4-role RBAC, protected routes
(global `JwtAuthGuard` + `RolesGuard`), rotating httpOnly refresh cookies.
Verified with a curl smoke test before continuing — the same flow that later
became the e2e spec.

## Phase 3 — Database
Prisma schema (20 tables), versioned migrations, `seed.ts`, full
relationships + indexes (incl. custom pg_trgm GIN via migration SQL).
ER diagram: `docs/DATABASE.md` + `docs/DIAGRAMS.md` #2.

## Phase 4 — Candidate Module
Profile (headline), skills/education/experience/certifications as normalized
tables, resume upload (PDF/DOCX, validated + sanitized), applications.
`POST /resumes` pipeline: validate → store → extract → AI parse →
sanitize → merge skills.

## Phase 5 — Job Module
Full posting form (all 12 spec fields), lifecycle `DRAFT→PUBLISHED⇄PAUSED→CLOSED`,
server-side search (10 filters, all SQL), pagination `{items,total,page,totalPages}`.

## Phase 6 — Application Pipeline
Apply → SCREENING → SHORTLISTED → INTERVIEW → OFFER → HIRED, plus REJECTED
(with reason) and candidate-only WITHDRAWN. Drag-and-drop kanban; every
transition appends to `application_status_history`.

## Phase 7 — Recruiter Dashboard
Job management (create/edit/publish/pause/close/delete-guarded), candidates
directory, kanban pipeline, funnel + 30-day application trend (Recharts).

## Phase 8 — Interview Module
Scheduling with ONLINE/PHONE/ONSITE, start+end times, distinct interviewer,
feedback (rating + text) linked to interviews, notifications on schedule.

## Phase 9 — AI Features
`AiService` abstraction (OpenAI → deterministic mock fallback): resume
parsing, skill extraction (→ normalized `skills` joins), job requirement
extraction, candidate-job matching, structured candidate summaries,
categorized editable interview questions, JD analysis. All AI output
sanitized before storage; all UI labels say "AI-generated estimate".

## Phase 10 — Notifications & Email
9 notification types (candidate + recruiter sides), unread badge polling,
mark read/all, `/notifications` center. `MailProvider` abstraction:
console → SMTP via env; 6 templates; hourly reminder cron.

## Phase 11 — Admin
User management (search/role filter/suspend), job moderation (reports +
resolve), company management, audit log (`activity_log`), platform analytics.

## Phase 12 — Testing
`0ff20c0` · 25 Jest unit tests (auth, guards, matching, sanitizer), 18-check
e2e workflow over real HTTP (`test/e2e.ts` — runs against the live app
because tsx/esbuild strips `design:paramtypes`), 5 Vitest frontend tests.

## Phase 13 — Docker & CI/CD
Multi-stage Dockerfiles for api + web, `postgres:16-alpine` + `pgdata`
volume + healthcheck-gated startup, `.github/workflows/ci.yml`:
install → lint → typecheck → test → build for both apps + Postgres-service
e2e. Explained in `docs/DOCKER.md`.

## Phase 14 — Deployment
`docs/DEPLOYMENT.md`: Vercel (frontend) + Docker host (backend) + managed
Postgres + S3 + SMTP — every external service swaps behind its interface via
env vars, no code changes.

---

**On "don't build everything at once"** — the commits prove it: each feature
landed in a focused commit, was verified live (curl or UI) before the next
started, and bugs found mid-phase (whitelist stripping, deadline
enforcement, notification guard) were fixed before moving on.
