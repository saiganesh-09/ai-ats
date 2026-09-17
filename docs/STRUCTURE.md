# Project Structure

```
ai-ats/
│
├── frontend/src/
│   ├── app/                 # Next.js App Router — routes = folders
│   │   ├── candidate/       #   /candidate/* — RequireRole(CANDIDATE) in layout
│   │   ├── recruiter/       #   /recruiter/* — RequireRole(RECRUITER, ADMIN)
│   │   ├── admin/           #   /admin/* — RequireRole(ADMIN)
│   │   ├── hiring/          #   /hiring — hiring-manager portal
│   │   ├── jobs/            #   public board + detail
│   │   └── notifications/   #   shared notification center (all roles)
│   ├── components/
│   │   ├── ui/              #   shadcn/ui primitives (button, dialog, select…)
│   │   ├── Navbar.tsx       #   role-aware nav + mobile hamburger + unread badge
│   │   ├── JobForm.tsx      #   shared create-job form (dialog + page reuse)
│   │   ├── ErrorState.tsx   #   standard fetch-failure view
│   │   └── badges.tsx       #   status/job/score badge components
│   └── lib/
│       ├── api.ts           #   fetch client: Bearer + auto-refresh-once-retry
│       ├── endpoints.ts     #   typed API surface (the only place URLs live)
│       ├── auth.tsx         #   AuthProvider, RequireRole, homeFor
│       └── types.ts         #   shared API types
│
├── backend/src/
│   ├── <feature>/           # one folder per domain — controller + module +
│   │                        # (service | dto | template | spec) inside:
│   │   auth/ companies/ profiles/ jobs/ resumes/ applications/
│   │   interviews/ notifications/ analytics/ admin/ activity/
│   │   ai/ email/ skills/ storage/ prisma/
│   └── common/
│       ├── guards.ts        #   JwtAuthGuard + RolesGuard (global)
│       ├── decorators.ts    #   @Public @Roles @CurrentUser
│       ├── http-exception.filter.ts   # uniform error envelope
│       └── logging.interceptor.ts     # structured JSON request logs
│
├── backend/prisma/
│   ├── schema.prisma        # single source of truth — 20 tables
│   ├── migrations/          # versioned SQL (incl. custom pg_trgm indexes)
│   └── seed.ts              # demo data: 7 users, company, jobs, applications
│
├── backend/test/
│   └── e2e.ts               # full recruitment workflow (real HTTP)
│   └── (*colocated)         # unit specs live as src/**/*.spec.ts
│
├── docs/                    # ARCHITECTURE DATABASE API SECURITY DOCKER DEPLOYMENT STRUCTURE
├── docker-compose.yml       # db + api + web
├── README.md
└── .github/workflows/ci.yml
```

## Deviations from the spec's example — and why

| Spec | Ours | Why |
|---|---|---|
| `src/modules/<feature>/` | `src/<feature>/` | The `modules/` level adds depth without distinction — every folder in src IS a module. Standard NestJS convention. |
| `src/middleware/` | `src/common/` | NestJS doesn't call them middleware — guards, interceptors, filters and decorators live in `common/` (framework-idiomatic naming interviewers recognize). |
| `src/config/` | `@nestjs/config` global | One `ConfigModule.forRoot({isGlobal:true})` in AppModule; env vars read where used. A folder for a one-liner is ceremony. |
| `src/database/` | `backend/prisma/` | Prisma owns its directory (schema + migrations + seed) — keeping it at package root matches every Prisma project. |
| `tests/` | `test/` + colocated `*.spec.ts` | NestJS convention: unit specs sit next to the file under test (import paths stay `./file`), e2e in `test/`. |
| `frontend/{hooks,services,types,utils}` | `frontend/src/lib/` | At this size, `lib/` holds api/auth/endpoints/types coherently. Premature splitting means 4 folders with 1–2 files each — easy to split later when it earns it. |
| `docs/{architecture,database,api}/` | flat `docs/*.md` | Each doc is one file, not a section — `docs/DATABASE.md` IS the database doc. Subdirs make sense only when a topic needs multiple files. |
