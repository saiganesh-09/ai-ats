# AI ATS — AI-Powered Applicant Tracking System

A production-style SaaS ATS: companies post jobs, candidates apply with
AI-parsed resumes, recruiters manage a kanban pipeline, hiring managers review
assigned candidates, and admins moderate the platform.

## Stack

| Layer      | Technology | Why |
|------------|-----------|-----|
| Frontend   | Next.js 16 (App Router) + React 19 + TypeScript | SSR/SEO for the public job board, one framework for pages + data |
| UI         | Tailwind v4 + shadcn/ui + Lucide | Accessible component primitives, real SaaS look |
| Forms      | React Hook Form + Zod | Performant forms with schema validation |
| Data       | TanStack Query | Server-state caching, invalidation, polling |
| Charts     | Recharts | Dashboards: funnel, trends, admin analytics |
| Backend    | NestJS (Node + TypeScript) | Modules, DI, Guards — enforces clean architecture |
| ORM        | Prisma | Schema-as-source-of-truth + typed client + migrations |
| Database   | PostgreSQL 16 | Relational core + JSONB for AI output |
| Auth       | JWT access (15m) + rotating refresh (httpOnly cookie), argon2id | Stateless + revocable sessions |
| Storage    | Object-storage abstraction (local impl, S3-swappable) | Spec-compliant: files never in DB |
| AI         | OpenAI `gpt-4o-mini` via service layer | Mock fallback keeps app working offline/free |

Docs: [architecture](docs/ARCHITECTURE.md) · [database + ERD](docs/DATABASE.md) · [interview notes](docs/INTERVIEW.md)

## Quick start

```bash
# 1. Postgres running locally (or use docker compose for everything)
psql postgres -c "CREATE USER ats_user WITH PASSWORD 'ats_dev_password' CREATEDB;"
psql postgres -c "CREATE DATABASE ai_ats_ts OWNER ats_user;"

# 2. API  →  http://localhost:3001/api
cd backend && npm install && cp .env.example .env   # add OPENAI_API_KEY (optional)
npx prisma migrate dev && npx prisma db seed
npm run start:dev

# 3. Web  →  http://localhost:3000
cd frontend && npm install && npm run dev
```

Or everything at once: `docker compose up --build`

**Demo logins** (all `password123`, invite code `acme-join-2026`):
`rita@acme.com` recruiter · `henry@acme.com` hiring manager · `admin@acme.com`
company admin · `super@ats.dev` platform admin · `carol@example.com` candidate

## Roles & access

| | Candidate | Recruiter | Hiring Manager | Company Admin | Superadmin |
|---|---|---|---|---|---|
| Profile, resumes, apply, save | ✓ | | | | |
| Company jobs & applicants | | ✓ | assigned only | ✓ | ✓ |
| Pipeline moves, notes, AI tools | | ✓ | feedback | ✓ | ✓ |
| Members, roles, company jobs | | | | ✓ | ✓ |
| All companies, moderation, reports | | | | | ✓ |

## Layout

```
backend/src/
├── main.ts / app.module.ts      # bootstrap, global guards (JwtAuth → Roles)
├── common/                      # @Public @Roles @CurrentUser, guards
├── prisma/                      # global PrismaService
├── auth/                        # register/login/refresh/logout + rotation
├── companies/  profiles/  jobs/  resumes/  applications/
├── interviews/  notifications/  analytics/  admin/
├── ai/ai.service.ts             # all LLM features + mock fallback
├── storage/storage.service.ts   # ObjectStorage iface + local impl (S3-ready)
└── activity/                    # audit log service
frontend/src/
├── lib/        api.ts (fetch+refresh), endpoints.ts (typed calls), auth.tsx, types.ts
├── components/ Navbar, badges, ui/ (shadcn)
└── app/        landing, login, register, jobs, dashboard/*, recruiter/*, hiring, admin/*
```
