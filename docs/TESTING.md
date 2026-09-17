# Testing

Three layers, each answering a different question.

## Unit tests — `cd backend && npm test` (25 tests, Jest)

Mocked-Prisma specs proving business logic in isolation:

| Suite | Covers |
|---|---|
| `auth.service.spec` | register (dup→409, hash≠plaintext), login (bad creds→401, suspended→403) |
| `applications.controller.spec` | apply guards (unpublished/expired/foreign resume→400/403, P2002→400), withdraw rules, notification triggers |
| `ai.service.spec` | deterministic mock scoring — matched/missing/bands |
| `parsed-resume.spec` | sanitizer vs hostile input: XSS, invalid email/phone, extra fields, skill dedupe |
| `app.controller.spec` | sanity |

Jest can't load the ESM dep chain (`argon2`, `@nestjs/jwt`) — both are
module-mocked in specs, documented inline.

## Integration/e2e — `cd backend && npm run test:e2e` (18 checks)

`test/e2e.ts` (tsx script) drives the **complete recruitment workflow** over
real HTTP against the live/built API:

register → login → RBAC denial → company → job DRAFT → publish → board
visibility → resume upload+parse → apply → duplicate reject → SHORTLISTED →
interview → candidate sees interview + 3 notifications → recruiter notified
→ mark-read decrement.

Why a script not Jest: tsx/esbuild strips `design:paramtypes`, so NestFactory
can't resolve DI in-process — a real server is the truer e2e anyway.
`E2E_BASE` env points it anywhere (CI boots `dist/src/main.js` against a
Postgres service container).

## Frontend — `cd frontend && npm test` (5 tests, Vitest)

`src/lib/logic.spec.ts`: role→portal routing (`homeFor`), job-form
`toJobPayload` conversion (numeric parse, CSV skills, blank→undefined).

## CI

`.github/workflows/ci.yml` runs all three layers on every push:
install → lint → typecheck → unit tests → build → (backend) migrate + boot
+ e2e against a Postgres service.
