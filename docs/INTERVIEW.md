# Interview Talking Points

## 60-second pitch

> "I built a multi-tenant SaaS applicant tracking system in TypeScript
> end-to-end: a Next.js frontend and a NestJS API over PostgreSQL with Prisma.
> It has real RBAC — four roles plus a platform superadmin — with access
> enforced at three levels: role, company tenancy, and per-job assignment.
> Auth is short-lived JWT access tokens with rotating refresh tokens stored
> hashed in the database. AI features — resume parsing, match scoring,
> candidate summaries, interview questions — sit behind one service with a
> deterministic mock fallback, so the app never hard-depends on OpenAI.
> Files go through an object-storage abstraction that's local now and S3 later."

## Why NestJS over Express?

Express gives you a router; NestJS gives you an architecture. RBAC is two
global guards + decorators, not middleware soup. DI makes the storage and AI
providers swappable by changing one registration. And modules match the
domain boundaries, which is what interviewers mean by "clean architecture."

## Questions + answers

**"Explain your RBAC."**
Four role checks, actually five layers: (1) global `JwtAuthGuard` authenticates
and loads the user — suspended users die here; (2) `RolesGuard` checks
`@Roles()` metadata; (3) tenant scoping — all staff queries filter by
`companyId`; (4) row scoping — hiring managers only touch jobs where
`hiringManagerId = them`; (5) ownership — candidates only their own records.
Superadmin is a separate flag, not a role, so platform access stays auditable.

**"How do your tokens work?"**
Login issues a 15-minute access JWT plus a 30-day refresh token in an httpOnly
cookie. Only the SHA-256 hash of the refresh token is stored. Every refresh
rotates: old token revoked, new pair issued — a stolen token works once. The
frontend retries a failed request after a silent refresh, so users never notice.

**"Talk me through the schema."**
Thirteen tables around a companies/users/jobs/applications core.
`applications` is a join table with a state machine — 8 statuses, a
unique(job,candidate) constraint for apply-once, and AI fields (score,
match details, summary). JSONB for AI output and profile lists since the
shape evolves; real Postgres arrays for skills since they stay queryable.
`activity_log` is the audit trail; `refresh_tokens` enables rotation.

**"What does 'object storage abstraction' buy you?"**
Code only sees `put(key, bytes)`/`get(key)` — same model as S3. Today it's
local disk behind a `STORAGE` DI token; production swaps in an S3 provider
with zero call-site changes. Files never touch Postgres — the DB keeps a key,
extracted text, and parsed JSON.

**"How is the AI designed?"**
One `AiService`, five operations, strict JSON-mode prompts. Every method wraps
OpenAI in a try→mock path: no key or a failed call produces deterministic
keyword-heuristic results instead of an error. Consequence: the demo works
offline, tests don't spend money, and an OpenAI outage degrades rather than
breaks the product.

**"Scaling next steps?"**
- AI calls → job queue (BullMQ) — parsing/scoring currently blocks the request
- pgvector embeddings for semantic matching + "similar candidates"
- Cursor pagination on pipelines, Redis cache on the public job board
- Presigned S3 URLs for downloads instead of streaming through the API
- Rate limiting (ThrottlerModule) + helmet; OpenAPI via @nestjs/swagger

**"What was the hardest part?"**
The refresh-rotation + silent-retry dance: the client holds the access token,
the cookie holds the refresh token, and a 401 has to refresh-then-retry
exactly once (concurrent 401s share one refresh promise). Also the RBAC
matrix — role checks are easy; role × tenant × row-assignment scoping is
where the real work was.

## Concepts demonstrated

Multi-tenancy · RBAC (role/tenant/row) · JWT + refresh rotation · DI/provider
swapping · ORM migrations (Prisma) · state machines · audit logging ·
LLM integration w/ fallback · React Query server-state · Zod-validated forms ·
Kanban UI · charting (funnel/trends) · Docker packaging
