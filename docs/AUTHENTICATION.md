# Authentication

## Model

Two-token JWT:

| Token | Lifetime | Where it lives | Purpose |
|---|---|---|---|
| Access | 15 min | `localStorage` → `Authorization: Bearer` | Every API call |
| Refresh | 30 days | httpOnly cookie, `path=/api/auth`, `sameSite=lax` | Silent re-auth |

The refresh token **rotates**: each `/auth/refresh` revokes the old token
and issues a new one. Only `sha256(token)` is stored — a stolen token works
at most once before its hash stops matching, and reuse is detectable.

## Why these choices

- **Access in localStorage, not cookie** — Bearer tokens are CSRF-immune
  (no ambient credential for the browser to attach).
- **Refresh in httpOnly cookie** — XSS can't read it; scoping to
  `/api/auth` means it can't even travel to non-auth routes.
- **argon2id** — memory-hard hashing; GPU brute-force resistant.
- **Rotation** — the standard mitigation for refresh-token theft (Auth0/
  OAuth BCP pattern).

## Authorization (three layers)

```
Request → JwtAuthGuard (valid token? → loads user, checks isActive)
        → RolesGuard (@Roles match? → superadmin bypass)
        → Controller scope (tenant: companyId; row: HM assigned jobs)
```

- `@Public()` opts routes out of the JWT guard.
- **Tenant scoping**: staff queries always carry `companyId`.
- **Row scoping**: HIRING_MANAGER role filters to `hiringManagerId = user.id`.
- **Suspended users** (`isActive=false`) can't log in and fail the guard on
  existing tokens — revocation without token bookkeeping.

## Frontend flow

`api.ts` attaches the Bearer token; on 401 it calls `/auth/refresh` once,
retries, and only then fails → login page. `RequireRole` guards routes;
`homeFor` lands each role on its portal.

## Files

`backend/src/auth/*` · `backend/src/common/guards.ts` · `decorators.ts` ·
`frontend/src/lib/api.ts` · `auth.tsx`
