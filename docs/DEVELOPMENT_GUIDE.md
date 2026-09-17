# Development Guide

## Setup

```bash
# Postgres (one-time)
psql postgres -c "CREATE USER ats_user WITH PASSWORD 'ats_dev_password' CREATEDB;"
psql postgres -c "CREATE DATABASE ai_ats_ts OWNER ats_user;"

# Backend
cd backend && cp .env.example .env && npm install
npx prisma migrate deploy && npx prisma db seed
npm run start:dev          # http://localhost:3001/api (+ /api/docs Swagger)

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Or everything at once: `docker compose up --build`.

**Demo logins** (`password123`): `carol@example.com` candidate ·
`rita@acme.com` recruiter · `henry@acme.com` hiring manager ·
`admin@acme.com` admin · `sam@technova.io` 2nd-tenant recruiter ·
`super@ats.dev` superadmin.

## Everyday commands

| Task | Command |
|---|---|
| Schema change | edit `schema.prisma` → `npx prisma migrate dev --name x` |
| Reset DB + reseed | `npx prisma migrate reset --force` |
| Inspect data | `npx prisma studio` |
| Unit tests | `cd backend && npm test` |
| e2e (needs API up) | `cd backend && npm run test:e2e` |
| Lint | `npm run lint` in either package |
| Screenshots | `cd frontend && node screenshots.mjs` (dev servers up) |

## Conventions

- **New endpoint**: controller route + `@Roles` → tenant scope via
  `companyId` → `activity.log()` if it's a domain action → notification +
  email if it affects another user → row in `docs/API.md`.
- **New frontend page**: route folder under the right role tree →
  `useQuery` for reads, `useMutation`+`toast`+`invalidateQueries` for
  writes → skeleton while loading → `ErrorState` on failure.
- **Every DTO field needs a class-validator decorator** — the global
  whitelist pipe silently strips undecorated properties (learned the hard
  way on the questions-edit endpoint).
- **JSON columns**: cast interface types `as Prisma.InputJsonValue`.
- **Never commit `.env`**; new config → `.env.example` + DEPLOYMENT.md.

## IDE quirk

`prisma generate` produces phantom "field doesn't exist" errors in the IDE
until you restart the TS server (language servers don't watch
`node_modules`) — `npx tsc --noEmit` is the source of truth.

## Repo layout

See [STRUCTURE.md](STRUCTURE.md) — annotated tree + deviation rationale.
