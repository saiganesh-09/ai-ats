# Interview Guide

Everything you need to present this project: the pitch, the architecture
talk, and 30 questions with answers you can adapt.

---

## Project introduction

"I built a multi-tenant applicant tracking system — full-stack TypeScript,
Next.js frontend, NestJS API, PostgreSQL. It supports four roles —
candidates, recruiters, hiring managers, and admins — with real
infrastructure: JWT auth with rotating refresh tokens, a kanban pipeline
with append-only status history, AI-assisted resume parsing and match
scoring, notifications, transactional email, audit logging, Docker, CI, and
a full test suite including an end-to-end recruitment workflow."

## Problem statement

Hiring software has to serve conflicting needs: candidates want transparency,
recruiters want triage speed, hiring managers want narrow focus, admins want
oversight — all without leaking one company's data to another. Most student
projects skip tenancy, audit trails, and auth hardening; I wanted the real
shape.

## Solution

A SaaS-quality ATS where:

- Every query is tenant-scoped — one company's data is unreachable from another
- The pipeline is a state machine with an immutable history
- AI is decision-support only — labeled estimates a human reviews
- Infrastructure is abstracted (storage, email, AI) — production swaps are config, not code

## Architecture explanation

```
Browser → Next.js (SSR public pages + client portals)
        → NestJS API: Throttler → JWT guard → Roles guard → controller
          (tenant + row scope) → Prisma → PostgreSQL
        → Object storage (resumes) · Mail provider · AI service
```

Three talking points:

1. **Guard chain is global** — no endpoint can forget auth/rate-limiting.
2. **Authorization is layered** — role check, then tenant scope, then row
   scope. Hiring managers literally cannot query other managers' jobs.
3. **JSONB where shape varies, tables where joins matter** — AI output is
   JSONB; skills are normalized because matching and recommendations are
   set intersections over join tables.

## Technology choices

| Choice | Why | Alternative rejected |
|---|---|---|
| NestJS | Enforces modules/DI/guards — architecture by default | Express (structure is opt-in) |
| Prisma | Schema-as-truth + typed client + migrations | TypeORM (decorator-heavy), raw SQL (no safety) |
| PostgreSQL | Relations + JSONB + pg_trgm in one store | MongoDB (pipeline is deeply relational) |
| Next.js | SSR job board + client portals in one framework | CRA (dead), separate SPA+SEO |
| TanStack Query | Server-state cache + polling + optimistic UX | Redux (overkill for server state) |
| argon2id + rotating refresh | Industry-best password hash + revocable sessions | bcrypt, single long-lived JWT |
| Native HTML5 DnD | Kanban without a 100KB DnD dependency | dnd-kit (unneeded weight) |

## Database explanation

20 tables. The design has three deliberate decisions:

- **Users + Profiles (subtype)** — `user` holds identity/role; `profile`,
  `experiences`, `educations`, `certifications`, `candidate_skills` hang off
  it. Keeps the auth table lean and lets non-candidates skip profile data.
- **Canonical `skills` table** — `job_skills` and `candidate_skills` both
  join to it. That one decision makes matching, search-by-skill, and
  recommendations all simple joins — the highest-leverage table in the schema.
- **Append-only `application_status_history`** — current status denormalized
  onto `application` for reads; history is the audit truth. Plus
  `activity_log` for non-pipeline events (logins, suspensions, admin actions).

## Authentication explanation

See [AUTHENTICATION.md](AUTHENTICATION.md). The pitch: "15-minute Bearer
JWT + 30-day refresh in an httpOnly cookie that rotates on every use —
only the SHA-256 hash is stored, so theft is single-use and detectable.
Authorization is role → tenant → row."

## API explanation

64 REST endpoints, versioned under `/api`, all documented in
[API.md](API.md) and interactive Swagger at `/api/docs`. Uniform error
envelope `{success:false, error:{code,message}}`, whitelist-validated DTOs,
offset pagination `{items,total,page,totalPages}` on every list.

## AI explanation

One `AiService` seam: OpenAI in production, deterministic mock otherwise —
tests and CI never need a key. Features: resume parsing, skill extraction,
match scoring, structured summaries, editable question banks, JD analysis.
Two hard rules: output is sanitized before storage (LLM output is untrusted
input), and everything is labeled "AI-generated estimate" — the system
makes zero automated decisions ([AI-GOVERNANCE.md](AI-GOVERNANCE.md)).

## Challenges faced

1. **Multi-tenancy everywhere** — a missed `companyId` scope is a data
   breach. Solved with a scoped-lookup helper (`companyJob`, `staffApplication`)
   every staff endpoint funnels through.
2. **Whitelist pipe silently dropping fields** — the questions-edit payload
   arrived empty because undecorated fields are stripped. Fix: `@IsObject()`
   + runtime shape check — and now it's a documented convention.
3. **ESM toolchain vs Jest** — `argon2`/`@nestjs/jwt` are ESM; Jest can't
   load them, and esbuild strips `design:paramtypes` so NestFactory can't
   boot under tsx. Solved by module-mocking in unit specs and running e2e
   against the live app — a truer end-to-end anyway.
4. **Trigram indexes vs Prisma** — Prisma can't express `USING gin
   (trgm_ops)`; migration diffs keep dropping them. Solution: custom
   migration SQL + re-create statements appended to every diff migration.

## Solutions (how I approached problems)

Reproduce → narrow → fix root cause, not symptom. The deadline-enforcement
bug is the pattern: search hid expired jobs but the apply endpoint didn't
check — the fix was server-side validation, not a frontend filter.

## Security

[SECURITY.md](SECURITY.md). Highlights: argon2id, refresh rotation,
three-layer authorization, whitelist validation, ORM parameterization,
sanitized AI output, upload validation, rate limiting (5/min on auth),
helmet, tenant-scoped CORS, audit logging, no secrets in frontend.

## Scalability

Current design scales honestly to mid-size: indexes on every hot path,
aggregation in SQL, paginated lists, stateless API (horizontal scaling is
just more replicas). Named next steps: presigned S3 uploads, `tsvector`
full-text search, Redis caching, WebSocket notifications — each listed in
README's future work rather than pretended.

## Future improvements

Presigned uploads · tsvector search · Redis cache · WebSocket delivery ·
calendar sync (ICS) · cursor pagination on hot lists · vector-similarity
recommendations.

---

# Interview Questions

## Basic (10)

**1. What does your project do?**
A multi-tenant ATS: companies post jobs, candidates apply with AI-parsed
resumes, recruiters run a kanban pipeline, admins moderate. Four roles,
real auth, real tests.

**2. Why Next.js instead of plain React?**
The public job board benefits from SSR (SEO + fast first paint) while the
portals are client-rendered — one framework covers both.

**3. Why NestJS instead of Express?**
NestJS enforces modules, dependency injection, and guards — the layered
architecture exists by default instead of depending on discipline.

**4. How do passwords get stored?**
argon2id hash only — memory-hard, GPU-resistant. Plaintext never touches
the DB.

**5. What's a JWT?**
A signed JSON token — the API verifies the signature instead of looking up
a session, so auth is stateless.

**6. Why two tokens instead of one?**
A stolen access token dies in 15 minutes; the refresh cookie is httpOnly
(XSS can't read it) and rotates, so theft is single-use.

**7. What is Prisma?**
An ORM where the schema file is the source of truth — it generates a typed
client and versioned migrations.

**8. What does `whitelist: true` do on the ValidationPipe?**
Strips any request-body field without a class-validator decorator —
mass-assignment protection.

**9. How do you prevent SQL injection?**
Prisma parameterizes everything; there's zero string-concatenated SQL in
the codebase.

**10. What's the kanban board?**
A drag-and-drop pipeline view — applications grouped by status; dropping a
card calls the status endpoint and writes a history row.

## Intermediate (10)

**11. How does multi-tenancy work?**
Every staff query carries `companyId` — recruiters only see their company's
jobs/candidates. Hiring managers go further: `hiringManagerId` row scoping.
Superadmin bypasses both for platform views.

**12. Explain the status history design.**
`application_status_history` is append-only: every transition writes
from→to, who, when, optional reason. Current status is denormalized on the
application for reads; the history is the audit trail.

**13. How do you handle a stolen refresh token?**
Rotation: every refresh revokes the old token and issues a new one. Only
hashes are stored — a stolen token works once, then its hash stops matching.

**14. How does job search scale?**
All filters are SQL: trigram GIN for substring, composite indexes for enum
combos and status+date, offset pagination — the DB does the work.

**15. What happens when AI is unavailable?**
`tryAi()` catches the error, logs a warning, and returns the deterministic
mock — the request succeeds with degraded intelligence, never a 500.

**16. Why sanitize AI output?**
LLM output is untrusted — it can contain HTML/XSS, invented fields, invalid
emails. `sanitizeParsed` whitelists and validates before storage, same as
user input.

**17. How do interviews get reminders?**
An hourly cron scans interviews starting in 23–25h with `reminderSentAt IS
NULL`, sends email+notification, stamps the flag — idempotent, each
interview reminds once.

**18. Why an email provider abstraction?**
Dev uses a console provider, production uses SMTP — swapped via `SMTP_HOST`
env with zero code changes. Sends are fire-and-forget so mail outages can't
fail requests.

**19. What's the recommendation engine?**
`candidate_skills ⋈ job_skills` — published jobs the candidate hasn't
applied to, scored by skill overlap with required skills weighted double.
A JOIN, not an ML model — explainable.

**20. How does CSRF protection work?**
The only cookie (refresh token) is `sameSite=lax` + scoped to `/api/auth`
— it can't ride cross-site and can't reach non-auth routes. Everything
else uses Bearer headers, which aren't ambient.

## Advanced (10)

**21. Walk me through the resume upload pipeline.**
Multipart → ext+mime+size+filename validation → object storage by opaque
key → text extraction (unpdf/mammoth) → AI parse → `sanitizeParsed` →
JSONB row + `candidate_skills` merge. Two trust boundaries: the file and
the AI output.

**22. How would you scale this to 10k concurrent users?**
The API is stateless → horizontal replicas behind a load balancer. Then:
connection pooling (PgBouncer), read replicas for analytics, Redis for hot
queries (unread counts, dashboards), presigned S3 uploads to bypass the API
for file traffic, tsvector for search at volume.

**23. Design decision you're proudest of?**
The canonical skills table. One normalized join powers search filtering,
match scoring, AND job recommendations — three features, one schema decision.

**24. Weakest part of the design?**
Offset pagination degrades on very deep pages (the DB still scans/skips),
and notifications poll every 30s rather than push — both acknowledged with
named fixes (cursor pagination, WebSockets) in future work.

**25. How do you handle the N+1 problem?**
Prisma `include`/`select` batch relations in one query; dashboards are
single aggregation endpoints with GROUP BY — no per-row queries.

**26. Explain the "don't trust AI" implementation.**
Three layers: `sanitizeParsed` validates structure/content before storage;
the UI labels everything "AI-generated estimate"; and AI output persists
as editable drafts — the human's version is the record. No automated
actions exist in the codebase.

**27. How does the error envelope work?**
A global `HttpExceptionFilter` maps every exception —
`HttpException` → `{success:false, error:{code,message}}` where code comes
from the exception payload or derives from status; non-HTTP errors become
INTERNAL_ERROR. Stacks log server-side only.

**28. What would break first under load?**
The unread-count poll — every logged-in user hits it every 30s. It's a
cheap indexed count, but at scale I'd move it to Redis or push delivery.
Being able to name your bottleneck matters more than pretending none exists.

**29. How do you test a workflow that spans five endpoints?**
`test/e2e.ts` — a tsx script driving the real workflow over HTTP:
register → login → company → job → publish → resume → apply → status →
interview → notifications. 18 checks; runs against the built app in CI
with a Postgres service container.

**30. What would you do differently?**
Start with the paginated envelope on every list from day one (retrofitting
shape-changes cost a commit), and consider event-driven notifications —
the current notification-table approach is simple and correct but a real
event bus would decouple producers from consumers at scale.
