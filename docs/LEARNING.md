# Learning Mode — Module-by-Module Explanations

Every major module explained the same way: what → why → tech → files →
request flow → interview answer. Read top to bottom, or jump to the module
you're asked about.

---

## 1. Authentication & Authorization

### What we built
Registration, login, logout, "who am I" — with a short-lived **access token**
(Bearer, 15 min) plus a **rotating refresh token** in an httpOnly cookie
(30 days). Role-based access control (CANDIDATE / RECRUITER / HIRING_MANAGER
/ ADMIN) enforced by two global guards.

### Why we built it
An ATS holds PII and salary data — auth is the trust boundary. Two-token
design because a long-lived stolen token is catastrophic: access tokens die
in 15 minutes, and refresh tokens *rotate*, so a leaked one works exactly
once before the stored hash no longer matches.

### Technologies used
- **argon2id** — memory-hard password hashing; resists GPU brute-force
  better than bcrypt. We store only the hash, never the password.
- **JWT** — stateless signed tokens; the API verifies without a DB lookup.
- **httpOnly cookie** — refresh token invisible to JavaScript → XSS can't
  steal it. `sameSite=lax` + `path=/api/auth` shrinks CSRF surface.
- **NestJS Guards** — `JwtAuthGuard` (is the token valid?) then `RolesGuard`
  (does the role match `@Roles`?) — run globally, so no endpoint can forget.
- **`@Public()` decorator** — opt-out for the 6 public routes instead of an
  allowlist regex.

### Important files
- `backend/src/auth/auth.controller.ts` — register/login/logout/refresh/me endpoints
- `backend/src/auth/auth.service.ts` — argon2 hashing, token issue/verify, rotation
- `backend/src/common/guards.ts` — JwtAuthGuard + RolesGuard
- `backend/src/common/decorators.ts` — `@Public @Roles @CurrentUser`
- `frontend/src/lib/auth.tsx` — AuthProvider + RequireRole + homeFor routing
- `frontend/src/lib/api.ts` — attaches Bearer, retries 401 once via refresh

### Request flow
```
User submits login form
      ↓
frontend: api.login() → POST /api/auth/login {email,password}
      ↓
AuthController.login → AuthService
      ↓
prisma.user.findUnique({email}) → argon2.verify(hash, password)
      ↓
issue accessToken + hash(refreshToken) → DB + httpOnly cookie
      ↓
{accessToken, user} → frontend stores token, routes by role
```

### Interview explanation
> "Authentication is two-token: a 15-minute JWT for requests and a 30-day
> refresh token in an httpOnly cookie that rotates on every use — we store
> only its SHA-256 hash, so a stolen refresh token is single-use and
> detectable. Authorization is layered: a global JWT guard, a roles guard,
> and then tenant + row scoping inside each controller — a recruiter only
> ever sees their own company's data, and a hiring manager only their
> assigned jobs."

---

## 2. Job Posting & Search

### What we built
Full job CRUD with a lifecycle (DRAFT → PUBLISHED ⇄ PAUSED → CLOSED), 12
posting fields including required-vs-preferred skills, and a public search
board with 10 server-side filters + pagination.

### Why we built it
This is the product's core surface: the public board needs real filtering at
scale — filtering in JavaScript means shipping every job to the browser.

### Technologies used
- **Prisma + PostgreSQL** — every filter maps to a `WHERE` clause; nothing
  filters in memory.
- **pg_trgm GIN indexes** — substring `ILIKE '%q%'` search; a B-tree can't
  do it. Written as custom migration SQL since Prisma can't express it.
- **class-validator DTOs** — enum/salary/deadline validation at the pipe.
- **TanStack Query `keepPreviousData`** — smooth pagination without flashes.

### Important files
- `backend/src/jobs/jobs.controller.ts` — CRUD, lifecycle, search, skill sync
- `frontend/src/app/jobs/page.tsx` — public board + filter bar
- `frontend/src/components/JobForm.tsx` — shared create/edit form
- `frontend/src/app/jobs/[id]/page.tsx` — public detail + apply entry

### Request flow
```
User types "react" in search
      ↓
frontend: api.listJobs({skills:'react', ...}) → GET /api/jobs?skills=react
      ↓
JobsController.search → Prisma where: {status:PUBLISHED, skills:{some:{name}}}
      ↓
findMany(skip,take) + count() — hits job_skills.skill_id index
      ↓
{items,total,page,totalPages} → TanStack Query cache → card grid + pager
```

### Interview explanation
> "Job search is fully server-side — keyword hits trigram GIN indexes,
> enums are indexed composites, salary is a range-overlap predicate, and
> pagination is offset-based `skip`/`take` plus a `count`. The interesting
> call was required vs preferred skills: a `required` flag on the
> `job_skills` join row, which lets the matching engine weight required
> skills double without a second table."

---

## 3. Resumes & AI Parsing

### What we built
PDF/DOCX upload → object storage → text extraction → AI parse →
**sanitized** JSONB → merged into the normalized `candidate_skills` table.

### Why we built it
Resumes are how candidates enter the system; the parse is what makes them
searchable. The spec's key line — "don't blindly trust AI" — became a real
sanitization layer, the module's best interview story.

### Technologies used
- **`ObjectStorage` interface** — files stored by opaque key; local impl
  today, S3 by dependency-injection swap. Files never live in Postgres.
- **unpdf / mammoth** — text extraction per format.
- **OpenAI via `AiService`** — structured JSON output; deterministic mock
  fallback when `OPENAI_API_KEY` is unset.
- **`sanitizeParsed()`** — strips HTML/XSS, whitelists fields, validates
  email/phone, dedupes skills before anything reaches the DB.

### Important files
- `backend/src/resumes/resumes.controller.ts` — upload pipeline, download, delete
- `backend/src/resumes/parsed-resume.ts` — sanitizeFilename + sanitizeParsed
- `backend/src/ai/ai.service.ts` — provider abstraction + mock + scoring
- `backend/src/storage/storage.service.ts` — STORAGE token + LocalStorageService
- `frontend/src/app/candidate/resume/page.tsx` — upload UI + parsed view

### Request flow
```
User drops a .docx
      ↓
api.uploadResume (multipart) → POST /api/resumes
      ↓
FileInterceptor → validate ext+mime+5MB → sanitizeFilename
      ↓
storage.put(key, buffer) → mammoth.extractRawText → ai.parseResume
      ↓
sanitizeParsed(raw AI output) → resumes row + candidate_skills merge
      ↓
resume {id, parsedStatus:PARSED} → UI shows parsed sections
```

### Interview explanation
> "The upload pipeline has two trust boundaries: the file is validated
> (extension AND mimetype, size cap, path-traversal-safe filename) and
> stored under an opaque key — then the AI's output goes through a
> sanitizer before the database sees it, because LLM output is untrusted
> input like any user input. Files live behind a storage interface, so
> moving to S3 is a provider swap, not a refactor."

---

## 4. Applications & the Pipeline

### What we built
Apply with a resume → recruiter moves candidates through APPLIED →
SCREENING → SHORTLISTED → INTERVIEW → OFFER → HIRED (or REJECTED/WITHDRAWN)
— on a drag-and-drop kanban, with an append-only status history.

### Why we built it
This is the ATS's reason to exist. The append-only history is the audit
trail — you can replay any candidate's journey and answer "who rejected
them and why."

### Technologies used
- **Append-only `application_status_history`** — rows are never updated;
  the current status lives on the application for fast reads, the history
  is the source of truth for "how did we get here."
- **Native HTML5 drag-and-drop** — no DnD library; cards carry
  `dataTransfer` payloads, columns are drop targets.
- **Prisma `P2002` handling** — `(job_id, candidate_id)` unique constraint
  becomes a friendly 400, not a 500.
- **Transaction-shaped side effects** — status change → history row +
  notifications + email in one logical unit.

### Important files
- `backend/src/applications/applications.controller.ts` — apply, status,
  withdraw, notes, AI endpoints
- `frontend/src/app/recruiter/jobs/[id]/page.tsx` — kanban board
- `frontend/src/app/recruiter/applications/[id]/page.tsx` — applicant detail:
  timeline, notes, AI panel, schedule dialog
- `frontend/src/app/candidate/applications/page.tsx` — candidate tracking

### Request flow
```
Recruiter drags card → INTERVIEW
      ↓
api.updateStatus(id,'INTERVIEW') → PATCH /api/applications/:id/status
      ↓
companyJob scope check → update status → insert history row
      ↓
notification (candidate) + email (fire-and-forget) + activity_log
      ↓
{application} → invalidate ['job-applications'] → card re-renders
```

### Interview explanation
> "The pipeline is a state machine with rules on both sides: staff can move
> anywhere except back into APPLIED, candidates can only withdraw — and
> only before INTERVIEW. Every move writes an immutable history row with
> who/when/why, so the timeline you see is reconstructed from audit data,
> not the other way around."

---

## 5. AI Matching, Summaries & Questions

### What we built
Four AI features on one service: match scoring (skills + experience +
education bands), structured candidate summaries, categorized interview
questions (editable + persisted), and JD analysis — all labeled
"AI-generated estimate."

### Why we built it
Recruiters drown in resumes — AI triage is the product's differentiator.
But scores are advisory: the UI always shows the label + a link to the
original resume.

### Technologies used
- **`AiService` facade** — one seam for all AI; OpenAI in prod,
  deterministic mock otherwise → tests and dev never need an API key.
- **Normalized `skills` table** — matching is a set intersection over
  `job_skills ∩ candidate_skills`, not fuzzy text comparison.
- **JSONB persistence** — `ai_summary`/`ai_questions` stored so recruiters
  can edit AI output — the AI drafts, the human decides.
- **Prompt engineering** — structured-output prompts mirror the mock's
  exact JSON shape, so the swap is invisible to the API contract.

### Important files
- `backend/src/ai/ai.service.ts` — all prompts + `mockScore` heuristic
- `backend/src/ai/ai.module.ts` — global module (every controller injects it)
- `backend/src/applications/applications.controller.ts` — score/summarize/questions routes
- `frontend/src/app/recruiter/applications/[id]/page.tsx` — AI panel UI

### Request flow
```
Recruiter clicks "Score"
      ↓
api.score(id) → POST /api/applications/:id/score
      ↓
AiService.scoreResume(resume.parsed, job.description, requirements)
      ↓
OPENAI_API_KEY? → OpenAI JSON response : mockScore (deterministic)
      ↓
{score,matched,missing,exp_band,edu_band,explanation} → save on application
      ↓
UI: badge + "AI-generated estimate" disclaimer + resume download link
```

### Interview explanation
> "AI sits behind a single service with a mock fallback — same interface,
> deterministic output — so the whole app works offline and in CI. Match
> scoring is explainable by design: matched skills, missing skills, and
> qualitative bands, always labeled an estimate, always one click from the
> source resume. And AI output never owns the record — summaries and
> questions persist as drafts the recruiter edits."

---

## 6. Interviews, Notifications & Email

### What we built
Interview scheduling (ONLINE/PHONE/ONSITE, start+end, distinct interviewer)
→ 9 notification types in a shared center → templated transactional email
behind a provider abstraction → hourly reminder cron.

### Why we built it
An ATS that doesn't tell people things is a spreadsheet. Notifications are
the engagement loop; email is the same events in the user's inbox.

### Technologies used
- **`@nestjs/schedule` cron** — hourly scan: interviews starting in 23–25h
  with `reminderSentAt IS NULL` → remind + stamp flag (idempotent).
- **`MailProvider` interface** — `ConsoleMailProvider` (dev) →
  `SmtpMailProvider` via `SMTP_HOST` env; fire-and-forget sends so a mail
  outage can't fail an HTTP request.
- **HTML email templates** — inline-styled functions in `templates.ts`
  (email clients strip `<style>` blocks).
- **Polling badge** — navbar polls `unread-count` every 30s (simple;
  WebSockets listed under future work).

### Important files
- `backend/src/interviews/interviews.controller.ts` — schedule + mine + company
- `backend/src/notifications/` — center endpoints + create helper
- `backend/src/email/` — service, providers, templates, reminder cron
- `frontend/src/app/notifications/page.tsx` — shared center
- `frontend/src/components/Navbar.tsx` — unread badge

### Request flow
```
Recruiter submits schedule form
      ↓
api.scheduleInterview → POST /api/interviews
      ↓
validate (end>start, ONLINE needs link, interviewer is staff)
      ↓
interview row → application.status=INTERVIEW → history
      ↓
notifications (candidate + interviewer) + invitation emails
      ↓
hourly cron: 23-25h window → reminder email + reminderSentAt stamp
```

### Interview explanation
> "The three pieces compose: scheduling is transactional (interview row +
> status move + history in one path), notifications are a typed event
> table the frontend polls, and email mirrors the same events through a
> provider interface — console in dev, SMTP in prod. Reminders are a cron
> over a null-flag scan — idempotent by design, each interview reminds
> exactly once."

---

## 7. Dashboards, Analytics & Admin

### What we built
Three role dashboards — candidate (completion %, pipeline snapshot,
skill-based job recommendations), recruiter (funnel + trend charts), admin
(users, companies, jobs, reports, audit log, platform analytics).

### Why we built it
Dashboards are where the data becomes decisions — and where the normalized
schema pays off: recommendations are `candidate_skills ⋈ job_skills` joins.

### Technologies used
- **Aggregation endpoints** — one request per dashboard, `GROUP BY`
  queries, not N API calls.
- **Recharts** — funnel bars, 30-day trend lines, admin totals.
- **Weighted recommendation scoring** — required skills count double;
  already-applied jobs excluded in SQL.
- **Tenant-scoped admin** — company admin sees their tenant, superadmin
  sees everything — same endpoints, different `WHERE`.

### Important files
- `backend/src/analytics/analytics.controller.ts` — all dashboard queries
- `backend/src/admin/admin.controller.ts` — users/companies/jobs/reports/activity
- `frontend/src/app/candidate/page.tsx` — candidate dashboard
- `frontend/src/app/recruiter/dashboard/page.tsx` — funnel + trend
- `frontend/src/app/admin/dashboard/page.tsx` — platform analytics

### Request flow
```
Candidate opens /candidate
      ↓
api.candidateDashboard() → GET /api/analytics/candidate-dashboard
      ↓
parallel queries: applications groupBy status, resume count,
  profile checkpoints, recommendations (skills join), notifications
      ↓
{statusCounts, completion, recommended[], unreadCount, ...}
      ↓
stat cards + progress bar + pipeline badges + recommended job rows
```

### Interview explanation
> "Each dashboard is one aggregation endpoint — counts, funnels, and
> recommendations computed in SQL, not stitched together client-side. The
> interesting query is recommendations: join the candidate's skills to
> published jobs' skills, weight required skills double, exclude
> already-applied and expired jobs — all in the WHERE. Profile completion
> is deliberately simple: a weighted checklist, not an ML feature."

---

## 8. Cross-Cutting: Guards, Errors, Logging, Storage

### What we built
The infrastructure every module shares: global guard chain
(Throttler → JWT → Roles), uniform error envelope filter, structured JSON
request logs, audit log, object-storage and mail abstractions.

### Why we built it
Cross-cutting concerns can't be opt-in — if a guard can be forgotten, it
will be. Everything here is registered globally via `APP_GUARD`/
`APP_INTERCEPTOR`/`APP_FILTER`.

### Technologies used
- **NestJS global providers** — `APP_*` tokens wire guards/interceptors/
  filters once for all controllers.
- **`HttpExceptionFilter`** — every exception →
  `{success:false, error:{code,message}}`; stacks stay server-side.
- **Structured logging** — one JSON line per request: method/path/status/
  ms/userId — never bodies, queries, or tokens.
- **`activity_log`** — domain audit trail (who did what to which entity)
  written at each action point.

### Important files
- `backend/src/common/guards.ts` · `decorators.ts` ·
  `http-exception.filter.ts` · `logging.interceptor.ts`
- `backend/src/activity/activity.service.ts` — `activity.log()` helper
- `backend/src/main.ts` — helmet, CORS, pipe, filter, Swagger wiring
- `backend/src/app.module.ts` — global provider registration

### Request flow
```
HTTP request
      ↓
ThrottlerGuard (100/min; 5/min auth) → JwtAuthGuard → RolesGuard
      ↓
Controller (tenant+row scope) → Prisma → Response
      ↓
RequestLoggingInterceptor → JSON line to stdout
   OR HttpExceptionFilter → uniform error envelope
```

### Interview explanation
> "Every request runs three guards in order — rate limit, authenticate,
> authorize — registered globally so no endpoint opts out by accident.
> Every error exits through one filter with a uniform envelope. Two audit
> layers: a structured HTTP log for operations (no sensitive data ever),
> and `activity_log` for business events (login, job created, status
> changed, user suspended) — the difference being logs are ephemeral,
> audit rows are queryable forever."
