# Security

Every item maps to code — nothing here is aspirational.

| Control | Implementation |
|---|---|
| **Password hashing** | argon2id via `argon2` — memory-hard, the current OWASP recommendation. Hash stored in `users.password_hash`, never returned (`publicUser` strips it). |
| **Authentication** | 15-min JWT access tokens (Bearer) + 30-day **rotating** refresh tokens. Only sha256(token) is persisted — a DB leak doesn't expose live tokens, and reuse of a rotated token is detectable. |
| **Authorization / RBAC** | Global guard order: `ThrottlerGuard → JwtAuthGuard → RolesGuard`. Role checks per endpoint; **tenant scoping** (companyId) and **row scoping** (hiring managers see only assigned jobs) enforced in queries, not the UI. |
| **Input validation** | `ValidationPipe({whitelist:true, transform:true})` — undecorated DTO fields are silently stripped (a real bug was caught by this). Runtime shape checks for JSON fields Prisma can't type. |
| **SQL injection** | Prisma parameterizes everything. The few raw queries (`trend`, `pg_trgm`) use `Prisma.sql`/`Prisma.empty` tagged templates — no string interpolation. |
| **XSS** | React escapes rendered output by default. Untrusted AI output is sanitized (`sanitizeParsed`) before storage: HTML stripped, control chars removed, fields whitelisted. Helmet sets CSP-adjacent headers. |
| **CSRF** | API calls use `Authorization: Bearer` (no cookie) → CSRF-immune. The only cookie is the refresh token: `httpOnly` + `sameSite=lax` + `secure` (prod) + **`path=/api/auth`** — scoped so it can't even be carried to non-auth routes. |
| **Rate limiting** | `@nestjs/throttler` global 100 req/min/IP; auth endpoints (login/register/refresh — brute-force targets) limited to 5–10/min. Verified: 6th login → 429. |
| **File uploads** | Extension **and** MIME validation, 5MB cap, empty rejection, filename sanitized (path traversal → basename), object-storage keys generated server-side. Download authorized: owner or receiving company only. |
| **Secrets** | All config via env vars (`DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `SMTP_*`). `.env` is gitignored + `.dockerignore`d (not baked into images). The frontend reads only `NEXT_PUBLIC_API_URL` — secrets never ship to the browser. |
| **CORS** | `enableCors({origin: CORS_ORIGIN, credentials: true})` — single explicit origin, not `*`; required for the cross-port refresh cookie. |
| **Audit logging** | `activity_log` records actor, action, entity, metadata for every state-changing operation; admins view it at `/admin/audit-logs`. |
| **Error safety** | `HttpExceptionFilter` emits `{success:false, error:{code,message}}`; non-HTTP errors become generic `INTERNAL_ERROR` — stack traces are logged server-side only, never sent to clients. |
| **Security headers** | `helmet()` — X-Frame-Options, nosniff, HSTS-ready. |
