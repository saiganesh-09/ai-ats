# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Browser
        SPA[React SPA<br/>Vite + TS + Tailwind]
    end

    subgraph Server
        API[FastAPI<br/>REST + JWT auth]
        AI[ai_service<br/>parse + score]
        PARSER[resume_parser<br/>PDF → text]
    end

    DB[(PostgreSQL<br/>users · jobs · resumes · applications)]
    OPENAI[(OpenAI API<br/>gpt-4o-mini)]

    SPA -- "HTTP/JSON<br/>Authorization: Bearer <jwt>" --> API
    API --> SQL[SQLAlchemy ORM] --> DB
    API --> PARSER
    API --> AI --> OPENAI
    AI -.->|no key / API failure| MOCK[mock heuristics]
```

## Request lifecycle: applying to a job

```mermaid
sequenceDiagram
    participant C as Candidate (React)
    participant API as FastAPI
    participant DB as PostgreSQL
    participant AI as OpenAI

    C->>API: POST /resumes (PDF file, JWT)
    API->>API: resume_parser: extract text (pypdf)
    API->>AI: parse_resume(text) → JSON
    AI-->>API: {summary, skills, experience, education}
    API->>DB: INSERT resume (raw_text + parsed JSONB)
    API-->>C: 201 + parsed profile

    C->>API: POST /applications {job_id, resume_id}
    API->>DB: INSERT application (unique job+candidate)
    API-->>C: 201

    Note over C,AI: Later, a recruiter reviews…
    C->>API: POST /applications/:id/score (recruiter JWT)
    API->>AI: score_match(parsed_resume, job)
    AI-->>API: {score, matched, missing, explanation}
    API->>DB: UPDATE application.match_score
```

## Backend layering

```
routers/      HTTP concerns only: parse request, call service/DB, shape response
deps.py       cross-cutting auth: JWT decode → load user → role check
services/     business logic that isn't HTTP or SQL: AI calls, file parsing
models.py     tables; schemas.py    wire contracts — never the same objects
```

The rule: routers never contain business logic, services never know about HTTP.
This is what makes `ai_service` swappable between OpenAI and the mock — the
router calls `ai_service.parse_resume()` and doesn't care which runs.

## Auth model

- Passwords hashed with **argon2id** (pwdlib) — memory-hard, GPU-resistant.
- Login issues a **JWT** signed with HS256, containing `sub` (user id), `role`,
  `exp`. No server-side session storage needed.
- Every protected request: `HTTPBearer` → decode JWT → load user from DB →
  `require_role` checks `recruiter` vs `candidate`.
- Authorization is enforced **server-side per resource**: recruiters can only
  see/modify their own jobs (`_owned_job`) and applications to them; candidates
  can only use their own resumes.

## Failure design

| Failure | Behavior |
|---|---|
| No `OPENAI_API_KEY` | Mock parser/scorer — app fully usable offline |
| OpenAI call throws | Falls back to mock result (AI degrades, app survives) |
| Duplicate application | DB unique constraint → 409, never a partial write |
| Scanned/image PDF | `UnsupportedFileError` → 422 with clear message |
| Recruiter hits another's job | 403 ownership check on every mutating route |
