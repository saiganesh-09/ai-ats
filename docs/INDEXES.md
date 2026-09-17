# Index Strategy

Every index exists to serve a measured query pattern — the spec's list is
covered, plus the composite + trigram indexes our actual queries need.

## jobs

| Index | Type | Serves | Why |
|---|---|---|---|
| `jobs_title_trgm` | GIN (pg_trgm) | `title ILIKE '%q%'` | B-tree can't serve substring search — trigram GIN is the Postgres answer to `%term%`. Custom migration SQL; Prisma can't express it. |
| `jobs_description_trgm` | GIN (pg_trgm) | `description ILIKE '%q%'` | Same — keyword search hits both columns. |
| `jobs_status_created_at_idx` | B-tree composite | public board `status='PUBLISHED' ORDER BY createdAt DESC` | The hottest query in the app — index returns rows already sorted, no sort step. |
| `jobs_status_employment_type_work_mode_idx` | B-tree composite | the common filter combo `status + type + mode` | One index covers the three equality filters used together most often. |
| `jobs_location_idx` | B-tree | `location ILIKE` | Spec-listed; the location filter runs on every filtered search. |
| `jobs_salary_max_idx` | B-tree | `salaryMax >= :min` overlap filter | Range comparison benefits from ordered index. |
| `jobs_company_id_idx` | B-tree | tenant scope — every staff query | The multi-tenant WHERE clause on essentially all recruiter/admin reads. |
| `jobs_hiring_manager_id_idx` | B-tree | HM row scoping | Hiring managers list only their assigned jobs. |

## applications

| Index | Serves | Why |
|---|---|---|
| `(job_id, candidate_id)` UNIQUE | duplicate-apply check + join | The "apply once" business rule enforced at the DB — also the lookup index. |
| `applications_candidate_id_idx` | candidate's "my applications" | Every dashboard load filters by candidate. |
| `applications_job_id_status_idx` | kanban columns `job + status` | Pipeline board reads group by status within a job. |
| `applications_status_idx` | `GROUP BY status` funnel analytics | The composite's leftmost column is job_id — status-alone aggregations don't use it; this covers dashboard funnels. |

## candidate_skills / job_skills

| Index | Serves | Why |
|---|---|---|
| `(user_id, skill_id)` PK | "this candidate's skills" | Composite PK — covers user-side lookups. |
| `candidate_skills_skill_id_idx` | "who has skill X" + recommendation joins | Recommendation query filters `skillId IN (...)` alone — the PK's leftmost column doesn't cover it. Same rationale for `job_skills`. |

## users / notifications / activity_log

| Index | Serves | Why |
|---|---|---|
| `users_email_key` UNIQUE | every login lookup | Login queries by email on every request — also the uniqueness rule. |
| `notifications_user_id_read_at_idx` | unread badge (`user + readAt IS NULL`) | The navbar polls this every 30s — composite covers the WHERE exactly. |
| `activity_log_created_at_idx` | audit log newest-first | Log tables grow; time-ordered reads need the index. |

## Rules of thumb applied

- **Leftmost-prefix rule**: `(status, createdAt)` serves status-alone queries
  but `(job_id, status)` does NOT serve status-alone — hence the separate
  `applications_status_idx`.
- **Indexes aren't free**: each costs a write on INSERT/UPDATE — every index
  here maps to a real query; no speculative indexes.
- **pg_trgm caveat**: migrate diffs drop non-Prisma indexes — each migration
  re-creates the trigram pair explicitly.
