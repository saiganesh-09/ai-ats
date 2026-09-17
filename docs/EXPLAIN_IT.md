# Explain It — The 17 Questions

Each answer has a **30-second version** (say this first) and the **deep
answer** (what to say when they dig in). File paths included so you can
point at code.

---

### 1. What problem does this project solve?

**30s:** It's a multi-tenant applicant tracking system — companies post
jobs, candidates apply, recruiters run a pipeline. The hard part isn't CRUD,
it's four roles with different powers and no data leaking between companies.

**Deep:** Real ATS software (Greenhouse, Lever) solves coordination:
candidates need status visibility, recruiters need triage speed at volume,
hiring managers should only see their own requisitions, and every action
needs an audit trail. Most student projects build "a job board with
login" — this builds the tenancy, pipeline state machine, history, and
notification layers that make it an actual ATS.

---

### 2. How does the frontend communicate with the backend?

**30s:** REST over HTTPS — a typed `endpoints.ts` layer wraps `fetch` with
Bearer tokens, and TanStack Query manages caching/invalidation/polling.

**Deep:** `frontend/src/lib/api.ts` is the only place that knows the base
URL and auth mechanics — it attaches `Authorization: Bearer`, and on 401
it calls `/auth/refresh` once and retries transparently. `endpoints.ts`
maps every one of the 64 routes to typed functions so components never
concatenate URLs. TanStack Query keys mirror resource names —
`['job-applications', id]` — and mutations invalidate the exact keys,
which is why the kanban re-renders after a status change without a manual
refresh. The contract side: every error arrives as
`{success:false,error:{code,message}}` and `ApiError` surfaces it.

---

### 3. How does authentication work?

**30s:** Two-token JWT — a 15-minute access token in memory/localStorage
for requests, a 30-day refresh token in an httpOnly cookie that rotates on
every use.

**Deep:** Passwords hash with argon2id (memory-hard — resists GPU
brute-force). Login issues both tokens; the refresh cookie is
`httpOnly`+`sameSite=lax`+scoped to `/api/auth`, so XSS can't read it and
CSRF can't carry it anywhere meaningful. Rotation is the clever part:
only `sha256(refreshToken)` is stored, each refresh revokes and re-issues —
a stolen token works at most once before the stored hash stops matching.
Suspended users (`isActive=false`) fail both login and the guard, which is
instant revocation without token bookkeeping.
→ `backend/src/auth/auth.service.ts`, `frontend/src/lib/api.ts`

---

### 4. How does RBAC work?

**30s:** Three layers: a global `RolesGuard` checks `@Roles()` decorators,
then every staff query carries `companyId` tenant scope, and hiring
managers get row-level scoping to their assigned jobs.

**Deep:** Layer 1 (`JwtAuthGuard`) loads the user and rejects invalid/
suspended tokens. Layer 2 (`RolesGuard`) compares the route's `@Roles`
metadata to `user.role`; superadmin bypasses. Layer 3 lives in the
controllers — `companyJob()`/`staffApplication()` helpers resolve entities
through `companyId`, and `HIRING_MANAGER` adds `hiringManagerId = user.id`.
The point: authorization isn't decorator-deep — even a correct role hits
scoped queries, so a recruiter from Acme physically cannot read TechNova's
data through any endpoint.
→ `backend/src/common/guards.ts`, scoped helpers in each controller

---

### 5. How is the database structured?

**30s:** 20 normalized Postgres tables. The interesting ones: `skills` is
canonical and joined to both candidates and jobs; `applications` carries
the pipeline state plus an append-only history table.

**Deep:** Three deliberate decisions. (1) **users/profiles split** —
identity vs role-specific data. (2) **Canonical `skills` + join tables** —
one normalized structure powers search filtering, match scoring, AND job
recommendations — three features, one schema decision. (3) **Append-only
history** — `application_status_history` never updates; current status is
denormalized onto `application` for reads, history is the audit truth.
JSONB is used only where shape genuinely varies (parsed resume, AI
results, notification payloads); anything we join or filter on is a real
column with an index.
→ `backend/prisma/schema.prisma`, `docs/DATABASE.md`, `docs/INDEXES.md`

---

### 6. How does a candidate apply for a job?

**30s:** Search → job detail → pick a resume → `POST /applications` —
the server validates the job is published and unexpired, owns the resume,
enforces apply-once, and notifies both sides.

**Deep:** `POST /api/applications {jobId, resumeId}` checks: job exists →
`status=PUBLISHED` → `applicationDeadline` not passed → resume exists and
belongs to this candidate → insert, catching `P2002` (the
`(job_id,candidate_id)` unique constraint) as a friendly 400. On success:
history row at APPLIED, `application.submitted` notification + confirmation
email to the candidate, `application.new` to the recruiter. The candidate's
dashboard then shows it under pipeline status.
→ `backend/src/applications/applications.controller.ts` `apply()`

---

### 7. How does the recruiter process an application?

**30s:** Kanban or detail page → drag/change status → history + notification
+ email fire automatically; AI score/summary/questions are on-demand
helpers, never gates.

**Deep:** `PATCH /applications/:id/status` — scoped lookup (company, and HM
restricted to assigned jobs) → update status → append history row with
actor + optional reason → notify candidate + status email (+ offer email
on OFFER) → `activity_log` row. Around that the recruiter can: view the
sanitized parsed resume, download the original file, run an AI score
(persisted to `matchScore`/`matchDetails`), generate an editable summary
or question bank, add notes, and schedule an interview — which also moves
the application to INTERVIEW.

---

### 8. How does the recruitment pipeline work?

**30s:** A state machine — APPLIED → SCREENING → SHORTLISTED → INTERVIEW →
OFFER → HIRED, plus REJECTED (with reason) and WITHDRAWN (candidate-only,
early stages). Every move is an immutable history row.

**Deep:** The UI is HTML5 drag-and-drop — cards POST `dataTransfer`, stage
columns are drop targets, REJECTED/WITHDRAWN prompts for a reason. Rules:
staff can't drop into APPLIED (entry-only); candidates can only withdraw
and only before INTERVIEW. The board is rendered by grouping a
`?jobId=` application list — no special endpoint needed. History replays
the whole journey on the applicant timeline.
→ `frontend/src/app/recruiter/jobs/[id]/page.tsx`

---

### 9. How are resumes stored?

**30s:** Files go to object storage under opaque keys — never the database.
Postgres holds metadata: filename, key, parsed JSON, raw text, status.

**Deep:** `ObjectStorage` is an interface injected via a `STORAGE` token —
`LocalStorageService` writes to disk now; an S3 impl is a provider swap.
Upload pipeline: FileInterceptor → extension+mime+5MB checks →
`sanitizeFilename` (kills `../../` traversal) → `storage.put` → text
extraction (unpdf/mammoth) → AI parse → `sanitizeParsed` → row. Download
streams through an authorized endpoint by storage key — the actual path is
never exposed.
→ `backend/src/storage/storage.service.ts`, `resumes.controller.ts`

---

### 10. How does AI analyze resumes?

**30s:** Extract text → send to the LLM with a structured-JSON prompt →
sanitize the output → store JSONB + merge skills into the profile.

**Deep:** `AiService.parseResume` returns 8 fields (name, contacts, skills,
education, experience, certs, projects, summary). The critical step is
`sanitizeParsed()`: strips HTML, whitelists fields per entity, regex-
validates email/phone, lowercases+dedupes skills — LLM output is treated
as untrusted input. Without `OPENAI_API_KEY` a deterministic mock runs —
same JSON shape, zero external calls. Parsed skills merge into
`candidate_skills`, which is what makes the candidate searchable/matchable.
→ `backend/src/ai/ai.service.ts`, `resumes/parsed-resume.ts`

---

### 11. How is candidate-job matching calculated?

**30s:** Set intersection — skills the job needs vs skills the resume has,
required skills weighted double, plus qualitative experience/education
bands and an explanation. Always labeled an estimate.

**Deep:** `job_skills` (from requirements + explicit lists, with a
`required` flag) intersects `candidate_skills` (from parsed resume). The
mock scorer: `matched = job∩resume`, `missing = job−resume`,
`score ≈ matched/total × 100` adjusted by requirement weights; experience
band derives from years, education band from degree presence — and it
*returns* the explanation, which is why the UI can show matched/missing
badges instead of a naked number. The LLM path mirrors the same output
shape. It's a heuristic deliberately — honest, explainable, and clearly
not a hiring decision.
→ `ai.service.ts` `mockScore()` · [AI-GOVERNANCE.md](AI-GOVERNANCE.md)

---

### 12. How are notifications generated?

**30s:** Server-side writes a typed `notifications` row at each event
(submit, status change, interview, feedback, withdrawal); the navbar polls
unread-count every 30s and the center lists/marks them.

**Deep:** Nine types, written transactionally with the action — a status
change writes history + notification + email + audit in one logical step.
Payloads carry `{jobTitle, candidateName, status}` so the frontend renders
human text without joins. `readAt` null = unread; mark-read stamps it;
mark-all is one update. Deliberately simple polling instead of WebSockets —
the right call at this scale, with push listed in future work.
→ `backend/src/notifications/`, `src/components/Navbar.tsx`

---

### 13. How does Docker work in this project?

**30s:** Three services on a private network — `db` (postgres:16-alpine +
volume), `api` (multi-stage NestJS build), `web` (multi-stage Next.js
build). `api` reaches Postgres at hostname `db` via Compose DNS; healthcheck
gates startup.

**Deep:** Multi-stage Dockerfiles: deps → build → slim runtime layer, so
source and devDeps never ship. `pgdata` volume survives `down`. `depends_on:
service_healthy` makes the API wait for `pg_isready` — no boot race.
`NEXT_PUBLIC_API_URL` is a build arg (Next inlines public env at build
time), while backend secrets are runtime env — nothing baked into images,
`.dockerignore` keeps `.env`/`node_modules` out of the build context.
→ `docker-compose.yml`, `docs/DOCKER.md`

---

### 14. How would I deploy this application?

**30s:** Vercel for the frontend, any Docker host (Render/Railway/ECS) for
the backend image, managed Postgres, S3 for storage, SMTP for email —
every swap is env vars, no code changes.

**Deep:** The abstraction seams make it: `DATABASE_URL` → managed Postgres;
`STORAGE_*` → S3 provider; `SMTP_*` → real mail; `OPENAI_API_KEY` → real AI;
`CORS_ORIGIN` → the Vercel domain; `NEXT_PUBLIC_API_URL` → the API domain.
Migrations run as `prisma migrate deploy` at container start or as a
deploy step. CI already proves the build path — the Dockerfile is the same
one CI builds.
→ `docs/DEPLOYMENT.md`

---

### 15. How would I scale it to millions of users?

**30s:** The API is stateless → horizontal replicas first; then the real
bottlenecks: DB pooling + read replicas, Redis for hot reads, S3 +
presigned URLs for file traffic, and search moved to `tsvector` or
Elasticsearch.

**Deep:** Ordered by what breaks first: (1) **unread-count polling** —
every user every 30s → Redis counter or push delivery. (2) **DB
connections** — PgBouncer + replicas; dashboards already aggregate in SQL.
(3) **Search** — trigram ILIKE has limits → `tsvector` GIN is a migration,
not a rewrite. (4) **File traffic** — resumes proxied through the API →
presigned uploads straight to S3. (5) **Deep pagination** — offset scans →
cursor pagination. (6) **Notifications** — event bus decouples producers.
The architecture supports each without structural change — that's what the
interface seams bought.
→ honest gaps also in README "Known limitations"

---

### 16. What security measures are implemented?

**30s:** argon2id, rotating refresh tokens, three-layer authorization,
whitelist validation, ORM parameterization, sanitized uploads + AI output,
rate limiting, helmet, scoped CORS, audit logging — no secrets client-side.

**Deep:** Each maps to a threat: argon2id→credential theft; rotation→token
theft; tenant+row scoping→IDOR; whitelist pipe→mass assignment; Prisma→
SQLi; `sanitizeParsed`+React escaping→XSS; `sameSite`+Bearer→CSRF;
throttler (5/min auth)→brute force; file validation→malicious upload;
secure cookie flags→token exfiltration; `activity_log`→accountability.
The one table in `docs/SECURITY.md` maps control→implementation→file.
→ [SECURITY.md](SECURITY.md)

---

### 17. What limitations does the AI system have?

**30s:** It's decision-support, not decision-making — labeled estimates
only, no automated actions, skills/experience/education inputs only (no
sensitive attributes), and the mock is heuristic without an API key.

**Deep:** Honest limits: the match score is a skills-intersection heuristic
— it can't read context, seniority nuance, or career trajectory; parsing
depends on extraction quality (scanned PDFs yield poor text); the LLM path
can hallucinate, which is exactly why `sanitizeParsed` exists; no
bias-audit tooling beyond "no protected attributes in scoring inputs";
and scores aren't calibrated across jobs — 56% on one job isn't the same
as 56% on another. The governance doc states all of this; recruiters can
review, override, or ignore every AI artifact.
→ [AI-GOVERNANCE.md](AI-GOVERNANCE.md)
