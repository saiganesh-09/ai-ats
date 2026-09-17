# Docker

## What Docker is

Docker packages an application **and everything it needs to run** — OS
libraries, runtime, dependencies, code — into an image. The image runs as an
isolated *container* that behaves identically on a laptop, a CI runner, and a
cloud VM. "Works on my machine" stops being a bug class.

## Why we use it

- **One-command dev environment**: `docker compose up --build` brings up all
  three services — no local Postgres install, no Node version juggling.
- **Production parity**: the same Dockerfile that runs locally is what Render/
  AWS would build — dev environment ≈ production environment.
- **Isolation**: Postgres data lives in a named volume, each service gets its
  own filesystem, and a broken container never touches the host.

## The containers

```
Docker Compose
│
├── web      frontend — Next.js prod build (multi-stage: deps → build → slim runtime)
├── api      backend  — NestJS + Prisma (multi-stage: build → prod deps → start)
└── db       postgres:16-alpine — official image, data persisted in `pgdata` volume
```

- `web`/`api` are built from our own Dockerfiles (`frontend/Dockerfile`,
  `backend/Dockerfile`) — multi-stage builds keep images small (source +
  devDependencies never ship to the runtime layer).
- `db` is the official Postgres image — no Dockerfile needed, everything is
  configured via environment.
- `.dockerignore` files keep `node_modules`, `.env`, and `.next`/`dist` out of
  the build context — faster builds and **no secrets baked into images**.

## Networking

Compose creates a private bridge network; containers reach each other by
**service name**. The API connects to `db:5432` (not `localhost`) —
`DATABASE_URL` in compose literally says `@db:5432`. `ports:` mappings expose
services to the host browser (`localhost:3000` → web, `localhost:3001` → api).
The db is reachable from the host too for `psql` debugging.

`depends_on` with `condition: service_healthy` orders startup: Postgres must
answer `pg_isready` before the API starts — otherwise the API would crash
connecting to a still-initializing database.

## Environment variables

Two sources, in priority order:

1. `environment:` block in compose — dev defaults (dev DB creds, JWT secret).
2. `${VAR:-default}` interpolation — `OPENAI_API_KEY` passes through from the
   host shell if set, empty string otherwise (→ AI mock fallback).

The frontend's `NEXT_PUBLIC_API_URL` is a **build arg**, not runtime env —
Next.js inlines public env vars at build time, so it's baked into the bundle.

## Start / stop

```bash
docker compose up --build     # build images + start all three (foreground)
docker compose up -d          # same, detached
docker compose logs -f api    # tail one service's logs
docker compose ps             # status
docker compose down           # stop + remove containers (data survives)
docker compose down -v        # also drop the pgdata volume — full reset
docker compose exec api npx prisma migrate deploy   # run migrations in-container
```

## Testing (§27)

- `cd backend && npm test` — 25 unit tests (auth, validation, matching,
  sanitizer, pipeline transitions) — Jest + mocked Prisma.
- `cd backend && npm run test:e2e` — 18-check full recruitment workflow over
  real HTTP (register → login → company → job → publish → resume → apply →
  status → interview → notifications) — needs the API running.
- `cd frontend && npm test` — Vitest: role routing + job-form payload logic.
