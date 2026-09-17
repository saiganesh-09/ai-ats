# Diagrams

Ten Mermaid diagrams covering the system end to end. Every diagram has a
plain-English explanation underneath. Mermaid renders natively on GitHub.

## 1. System Architecture

```mermaid
flowchart TB
    U["User<br/>Candidate · Recruiter · Manager · Admin"]
    FE["Next.js Frontend<br/>React + TypeScript"]
    API["NestJS API<br/>Node + TypeScript"]
    DB[("PostgreSQL")]
    AI["AI Service<br/>LLM (OpenAI) + mock fallback"]
    FS[("Object Storage<br/>local now · S3 later")]
    MAIL["Mail Provider<br/>console → SMTP"]

    U --> FE
    FE -- "HTTPS / REST (Bearer JWT)" --> API
    API --> DB
    API --> AI
    API --> FS
    API --> MAIL
```

**In plain English:** Users talk only to the frontend. The frontend calls the
API over HTTPS with a JWT. The API owns every downstream dependency — the
database holds relational data, files live in object storage (Postgres only
stores the key), the AI service wraps the LLM behind a mock fallback, and
email goes through a swappable provider. No client ever touches the database
or storage directly.

## 2. ER Diagram (core entities)

```mermaid
erDiagram
    COMPANIES ||--o{ JOBS : posts
    COMPANIES ||--o{ USERS : employs
    USERS ||--o| PROFILES : has
    USERS ||--o{ RESUMES : uploads
    USERS ||--o{ APPLICATIONS : submits
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ SAVED_JOBS : saves
    USERS ||--o{ CANDIDATE_SKILLS : has
    USERS ||--o{ EXPERIENCES : has
    USERS ||--o{ EDUCATIONS : has
    USERS ||--o{ CERTIFICATIONS : has
    SKILLS ||--o{ CANDIDATE_SKILLS : tags
    SKILLS ||--o{ JOB_SKILLS : requires
    JOBS ||--o{ JOB_SKILLS : has
    JOBS ||--o{ APPLICATIONS : receives
    JOBS ||--o{ SAVED_JOBS : saved_in
    JOBS ||--o{ REPORTS : reported_in
    APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : tracked_by
    APPLICATIONS ||--o{ NOTES : annotated_by
    APPLICATIONS ||--o{ FEEDBACK : reviewed_in
    APPLICATIONS ||--o{ INTERVIEWS : scheduled_in
    INTERVIEWS ||--o{ FEEDBACK : evaluated_in
```

**In plain English:** A company posts jobs; a user applies to them, producing
an *application* — the pipeline's center of gravity. Everything hangs off
either the user (profile, resumes, skills, notifications) or the application
(status history, notes, feedback, interviews). Skills are a canonical table
joined to both candidates and jobs, which is what makes skill-based matching
and job recommendations a simple join. See `DATABASE.md` for the full ERD.

## 3. User Flow (by role)

```mermaid
flowchart TD
    A["/ (landing)"] --> B{Logged in?}
    B -- No --> C["/login or /register"]
    C --> D{Role}
    B -- Yes --> D
    D -->|CANDIDATE| E["/candidate<br/>dashboard: completion %,<br/>recommended jobs, pipeline"]
    D -->|RECRUITER| F["/recruiter/dashboard<br/>funnel + trend charts"]
    D -->|HIRING_MANAGER| G["/hiring<br/>assigned jobs only"]
    D -->|ADMIN| H["/admin/dashboard<br/>platform analytics"]
    E --> E1["search jobs → apply → track status<br/>→ interviews → notifications"]
    F --> F1["post jobs → kanban pipeline →<br/>score AI → schedule interviews"]
    G --> G1["review applicants → leave feedback"]
    H --> H1["users · companies · jobs · reports · audit log"]
```

**In plain English:** One landing page, one login — then the router sends
each role to its own portal. Candidates get a personal dashboard, recruiters
get the hiring cockpit, hiring managers see only their assigned jobs, and
admins get the platform view.

## 4. Candidate Application Flow

```mermaid
flowchart LR
    S["Search jobs<br/>(filters in SQL)"] --> J["Job detail<br/>+ report/save"]
    J --> R{"Resume<br/>uploaded?"}
    R -- No --> U["Upload PDF/DOCX<br/>→ AI parses + merges skills"]
    U --> J
    R -- Yes --> AP["Apply<br/>+ optional cover note"]
    AP --> N1["Notification + email:<br/>application confirmed"]
    AP --> N2["Recruiter notified:<br/>new application"]
    N1 --> W["Track in dashboard<br/>status badges + timeline"]
    W --> I["Interview scheduled →<br/>upcoming interviews + reminder email"]
    W --> O["Offer / Hired / Rejected<br/>notification + email each step"]
    W -.->|APPLIED or SCREENING only| WD["Withdraw<br/>→ recruiter notified"]
```

**In plain English:** Search → detail → apply with a resume (upload first if
needed — AI parses it). Every step notifies: the candidate gets a receipt,
the recruiter gets the application. Status changes, interviews, offers and
rejections all flow through notifications + email, and the dashboard shows
the whole journey.

## 5. Recruitment Pipeline

```mermaid
stateDiagram-v2
    [*] --> APPLIED : candidate applies
    APPLIED --> SCREENING : staff moves
    SCREENING --> SHORTLISTED : staff moves
    SHORTLISTED --> INTERVIEW : interview scheduled
    INTERVIEW --> OFFER : staff moves
    OFFER --> HIRED : accepted
    APPLIED --> WITHDRAWN : candidate only
    SCREENING --> WITHDRAWN : candidate only
    APPLIED --> REJECTED : staff + reason
    SCREENING --> REJECTED : staff + reason
    SHORTLISTED --> REJECTED : staff + reason
    INTERVIEW --> REJECTED : staff + reason
    OFFER --> REJECTED : staff + reason
    note right of APPLIED
        Every transition writes an
        append-only status_history row:
        who, when, from→to, reason.
        Candidates can only withdraw,
        and only early in the pipeline.
    end note
```

**In plain English:** A kanban board — staff drag cards forward, candidates
can only withdraw (and only before interview). Every move lands in
`application_status_history` as an immutable audit row, so the timeline on
the applicant page replays the whole journey.

## 6. Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as NestJS API
    participant DB as Postgres

    C->>API: POST /auth/login {email, password}
    API->>DB: user + argon2.verify(hash)
    API-->>C: accessToken (15 min) + httpOnly cookie (refresh, 30d, path=/api/auth)
    Note over C: accessToken in memory/localStorage<br/>cookie is invisible to JS (XSS can't steal it)
    C->>API: GET /jobs (Bearer token)
    Note over C: 15 min later…
    C->>API: request → 401
    C->>API: POST /auth/refresh (cookie)
    API->>DB: verify sha256(token) — ROTATE: revoke old, issue new
    API-->>C: new accessToken + new rotated cookie
    C->>API: retry original request → 200
    Note over API,DB: stolen refresh token works once —<br/>second use = reuse detected
```

**In plain English:** Short-lived access tokens do the work; the refresh
token lives in an httpOnly cookie that JavaScript can't read, scoped to
`/api/auth` so CSRF can't carry it elsewhere. Refresh tokens rotate — only
the hash is stored — so a leaked token is single-use. The frontend retries
401s once through refresh transparently.

## 7. API Architecture

```mermaid
flowchart LR
    REQ["HTTP request"] --> T["ThrottlerGuard<br/>100/min global · 5/min auth"]
    T --> J["JwtAuthGuard<br/>verify Bearer"]
    J --> R["RolesGuard<br/>@Roles check"]
    R --> CTRL["Controller<br/>tenant + row scoping"]
    CTRL --> P["PrismaService<br/>parameterized queries"]
    CTRL --> INT["RequestLoggingInterceptor<br/>JSON line: method/path/status/ms"]
    P --> DB[("PostgreSQL")]
    CTRL -.->|"throws"| F["HttpExceptionFilter<br/>{success:false,error:{code,msg}}"]
```

**In plain English:** Every request passes three guards in order — rate
limit, authenticate, authorize — then the controller applies tenant and row
scoping before touching Prisma. The interceptor logs a structured line for
every call; thrown exceptions become the uniform error envelope. Guards,
interceptor, and filter are all global — no endpoint can forget them.

## 8. AI Resume Analysis Flow

```mermaid
flowchart TD
    UP["Resume upload<br/>PDF/DOCX ≤5MB"] --> FS["Object storage<br/>(opaque key)"]
    FS --> TXT["Text extraction<br/>unpdf / mammoth"]
    TXT --> AI["AI parse<br/>OpenAI or mock"]
    AI --> SAN["sanitizeParsed<br/>strip HTML · whitelist fields<br/>validate email/phone · dedupe skills"]
    SAN --> DB[("resumes.parsed JSONB<br/>+ candidate_skills merge")]
    DB --> REC["Recruiter clicks Score"]
    REC --> MT["mockScore / LLM:<br/>matched · missing · experience<br/>education · score · explanation"]
    MT --> UI["Applicant page<br/>'AI-generated estimate' label<br/>+ download original resume"]
```

**In plain English:** The spec's example flow with two safety gates it didn't
draw: uploads are validated and stored by key (never in the DB), and AI
output is *sanitized* before it's trusted — scripts stripped, fields
whitelisted. Scores are always labeled as estimates next to the original
resume download.

## 9. Deployment Architecture

```mermaid
flowchart TB
    DEV["Developer push"] --> GH["GitHub<br/>CI: lint → typecheck → test → build"]
    GH --> V["Vercel<br/>Next.js frontend"]
    GH --> RN["Render / Railway<br/>Docker: backend"]
    V -- "NEXT_PUBLIC_API_URL" --> RN
    RN --> PG[("Managed Postgres<br/>Neon/RDS")]
    RN --> S3[("S3<br/>resume objects")]
    RN --> SMTP["SMTP provider<br/>transactional email"]
    RN --> OAI["OpenAI API"]
```

**In plain English:** Push → CI gates the build → frontend ships to Vercel,
backend to a Docker host. Each external service swaps in via env vars:
managed Postgres for the DB URL, S3 for the `STORAGE` provider, SMTP for the
`MailProvider`, OpenAI for `AiService`. Every provider is behind an
interface — the swap is configuration, not code.

## 10. Docker Architecture

```mermaid
flowchart TB
    subgraph compose["docker compose"]
        WEB["web<br/>Next.js prod build<br/>:3000"]
        API["api<br/>NestJS + Prisma<br/>:3001"]
        DB[("db<br/>postgres:16-alpine<br/>:5432")]
        VOL[["pgdata volume"]]
    end
    HOST["Host browser<br/>localhost:3000 / :3001"] --> WEB
    HOST --> API
    WEB -->|"NEXT_PUBLIC_API_URL<br/>(baked at build)"| API
    API -->|"@db:5432<br/>(service-name DNS)"| DB
    DB --- VOL
    API -->|"healthcheck-gated<br/>depends_on"| DB
```

**In plain English:** Three services on a private Compose network — `api`
reaches Postgres at the hostname `db` (Compose's built-in DNS), the browser
reaches web/api through published ports. The API waits for Postgres's
`pg_isready` healthcheck before starting; data survives `down` in the
`pgdata` volume. `NEXT_PUBLIC_API_URL` is a build arg because Next.js
inlines public env at build time.
