# API Reference

Base URL: `http://localhost:3001/api` (dev). All bodies are JSON unless noted.

## Conventions

| Concern | Rule |
|---|---|
| **Authentication** | `Authorization: Bearer <accessToken>` — 15-min JWT from `/auth/login`. Refresh via `POST /auth/refresh` (httpOnly cookie, rotated). All endpoints require auth unless marked **Public**. |
| **Authorization** | `@Roles` guard after the JWT guard. Staff = RECRUITER · HIRING_MANAGER · ADMIN. Company admin is tenant-scoped; `isSuperadmin` bypasses. Hiring managers are additionally **row-scoped** to assigned jobs. |
| **Errors** | `{ "statusCode": N, "message": "...", "error": "..." }` — 400 validation, 401 unauthenticated, 403 wrong role/tenant/row, 404 not found, 409 conflict, 422 unprocessable (e.g. unreadable resume). |
| **Email side effects** | Status changes, applications, interviews fire notifications **and** emails — fire-and-forget, never fail the request. |

Roles: `CANDIDATE` `RECRUITER` `HIRING_MANAGER` `ADMIN` (+`isSuperadmin` flag).

---

## Auth — `/auth`

| Method | URL | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{email, password, fullName, role, inviteCode?}` | `{user, accessToken}` + refresh cookie | 409 email taken, 400 invalid invite |
| POST | `/auth/login` | Public | `{email, password}` | `{user, accessToken}` + refresh cookie | 401 bad credentials, 403 suspended |
| POST | `/auth/refresh` | Public (cookie) | — | `{accessToken}` + rotated cookie | 401 invalid/reused token |
| POST | `/auth/logout` | Yes | — | `{ok:true}`, clears cookie | — |
| GET | `/auth/me` | Yes | — | `User` | 401 |

## Companies — `/companies`

| Method | URL | Auth/Role | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/companies` | Public | — | `[{id, name, _count:{jobs}}]` | — |
| POST | `/companies` | RECRUITER, ADMIN | `{name}` | `Company` (with inviteCode) | 400 already in company |
| POST | `/companies/join` | RECRUITER, HIRING_MANAGER, ADMIN | `{inviteCode}` | `Company` | 400 bad code / already in company |
| GET | `/companies/mine` | Staff | — | `Company + users[]` (null if none) | — |
| PATCH | `/companies/members/:userId/role` | ADMIN | `{role}` | `User` | 403 other company, 400 bad role |

## Profiles — `/profiles`

| Method | URL | Auth/Role | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `/profiles/mine` | CANDIDATE | — | Composed profile: headline, skills[], experiences[], educations[], certifications[] | — |
| PUT | `/profiles/mine` | CANDIDATE | `{headline?, skills?[], experience?[], education?[], certifications?[]}` | Updated profile | — |
| GET | `/profiles/candidate/:userId` | Staff | — | Same shape — used to review applicants | — |

## Jobs — `/jobs`

| Method | URL | Auth/Role | Body / Query | Response | Errors |
|---|---|---|---|---|---|
| GET | `/jobs` | Public | Query: `q, location, skills (csv), experienceLevel, employmentType, workMode, salaryMin, salaryMax, postedWithin (days), sort (newest\|oldest\|title\|salary), page, pageSize` | `{items[], total, page, pageSize, totalPages}` — PUBLISHED + deadline-open only | — |
| GET | `/jobs/:id` | Public | — | `Job + company + skills[]` | 404 draft/missing |
| GET | `/jobs/manage/list` | Staff | — | Company jobs (HM: assigned only) + `_count.applications` | 403 |
| POST | `/jobs` | RECRUITER, ADMIN | `{title, description, location?, requirements?, employmentType, experienceLevel, workMode, salaryMin?, salaryMax?, educationRequirement?, applicationDeadline?, openings?, requiredSkills?[], preferredSkills?[], hiringManagerId?}` | `Job` (status=DRAFT) | 400 no company / salaryMin>max / past deadline / bad HM |
| PATCH | `/jobs/:id` | RECRUITER, ADMIN | Any subset of create fields | `Job` | 403 other company, 400 salary check |
| POST | `/jobs/:id/publish` | RECRUITER, ADMIN | — | `Job` (DRAFT or PAUSED → PUBLISHED) | 400 if CLOSED |
| POST | `/jobs/:id/pause` | RECRUITER, ADMIN | — | `Job` (PUBLISHED → PAUSED) | 400 if not PUBLISHED |
| POST | `/jobs/:id/close` | RECRUITER, ADMIN | — | `Job` → CLOSED | 403 |
| DELETE | `/jobs/:id` | RECRUITER, ADMIN | — | `{ok:true}` | 400 has applications (close instead), 403 |
| POST | `/jobs/:id/analyze` | RECRUITER, ADMIN | — | AI JD analysis `{required_skills, nice_to_have, seniority, clarity_score, suggestions}` | 403 |
| POST | `/jobs/:id/save` | CANDIDATE | — | `SavedJob` (upsert) | 404 unavailable |
| DELETE | `/jobs/:id/save` | CANDIDATE | — | 204 | — |
| GET | `/jobs/saved/mine` | CANDIDATE | — | `SavedJob[] + job + company` | — |
| POST | `/jobs/:id/report` | CANDIDATE | `{reason}` | `Report` | 404 |

## Resumes — `/resumes`

| Method | URL | Auth/Role | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/resumes` | CANDIDATE | multipart `file` (.pdf/.docx/.txt, ≤5MB) | `Resume` (`parsedStatus` PENDING→PARSED/FAILED; AI output sanitized) | 400 size/empty, 422 type/unreadable |
| GET | `/resumes/mine` | CANDIDATE | — | `Resume[]` | — |
| DELETE | `/resumes/:id` | CANDIDATE | — | 204 | 400 attached to application, 404 |
| GET | `/resumes/:id/download` | Owner, or staff whose company received it | — | File stream | 403, 404 |

## Applications — `/applications`

| Method | URL | Auth/Role | Body / Query | Response | Errors |
|---|---|---|---|---|---|
| POST | `/applications` | CANDIDATE | `{jobId, resumeId, coverNote?}` | `Application` (status=APPLIED, history row, notifications+emails to both sides) | 404 job/resume, 400 duplicate / deadline |
| GET | `/applications/mine` | CANDIDATE | — | Own applications + job + company | — |
| POST | `/applications/:id/withdraw` | CANDIDATE | — | `Application` → WITHDRAWN (only from APPLIED/SCREENING; recruiter notified) | 400 wrong stage, 404 |
| GET | `/applications/company` | Staff | `?q=` (candidate name) | All company applications + candidate + job + assignee (HM: assigned jobs) | 403 |
| GET | `/applications/job/:jobId` | Staff | `?q=, status=, sort=score\|score_asc\|oldest` | Pipeline list for one job | 403 |
| GET | `/applications/:id` | Staff | — | Detail: candidate profile, resume.parsed, notes, feedback, history, aiSummary, aiQuestions | 403 |
| PATCH | `/applications/:id/status` | Staff | `{status, reason?}` | `Application`; writes status_history + notification + email (+offer email on OFFER) | 400 bad status/stage |
| PATCH | `/applications/:id/assign` | RECRUITER, ADMIN | `{recruiterId}` | `Application` | 400 assignee not company staff |
| POST | `/applications/:id/notes` | Staff | `{text}` | `Note` (internal, invisible to candidate) | 403 |
| POST | `/applications/:id/feedback` | Staff | `{text, rating? 1-5, interviewId?}` | `Feedback` (recruiter notified) | 403 |
| POST | `/applications/:id/score` | Staff | — | `MatchDetails {score, matched_skills[], missing_skills[], experience_match, education_match, explanation}` | 403 |
| POST | `/applications/:id/summarize` | Staff | — | `CandidateInsights {summary, key_skills[], relevant_experience, strengths[], missing_requirements[], interview_areas[]}` — persisted to `aiSummary` | 403 |
| POST | `/applications/:id/questions` | Staff | — | `QuestionBank` (5 categories) — persisted | 403 |
| PUT | `/applications/:id/questions` | Staff | `{questions: {category: string[]}}` | Saved bank | 400 bad shape, 403 |

## Interviews — `/interviews`

| Method | URL | Auth/Role | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/interviews` | Staff | `{applicationId, type (ONLINE\|PHONE\|ONSITE), scheduledAt, endsAt?, interviewerId?, location?, link?, notes?}` | `Interview`; application → INTERVIEW; candidate + interviewer notified; invitation email | 400 end≤start / ONLINE w/o link / bad interviewer / terminal app |
| GET | `/interviews/company` | Staff | — | Company interviews + candidate + job + interviewer (HM: assigned) | 403 |
| GET | `/interviews/mine` | CANDIDATE | — | Own interviews + job + company + interviewer | — |

Background: hourly cron emails+notifies candidates ~24h before each interview (`reminder_sent_at` dedupe).

## Notifications — `/notifications`

| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/notifications/mine` | Any | — | `Notification[]` (newest first) |
| GET | `/notifications/unread-count` | Any | — | `{count}` — navbar polls every 30s |
| PATCH | `/notifications/:id/read` | Any | — | `Notification` (own rows only) |
| PATCH | `/notifications/read-all` | Any | — | `{count}` updated |

Types: `application.submitted`, `application.status`, `application.new`, `candidate.withdrawn`, `interview.scheduled`, `interview.assigned`, `interview.reminder`, `feedback.new`.

## Analytics — `/analytics`

| Method | URL | Auth/Role | Response |
|---|---|---|---|
| GET | `/analytics/dashboard` | Staff | `{totalJobs, activeJobs, totalApplicants, shortlisted, interviewsScheduled, offers, hires, rejectionRate, funnel{status→count}, trend[{day,count}]}` — company-scoped |
| GET | `/analytics/candidate-dashboard` | CANDIDATE | `{profileCompletion, missingCheckpoints, statusCounts, savedJobs, upcomingInterviews, unreadNotifications, recommendedJobs[]}` |

## Admin — `/admin` (all: ADMIN role; company admin tenant-scoped, superadmin platform-wide)

| Method | URL | Body / Query | Response | Errors |
|---|---|---|---|---|
| GET | `/admin/analytics` | — | `{totalUsers, totalCandidates, totalRecruiters, totalCompanies, totalJobs, activeJobs, totalApplications, successfulHires, trends}` | — |
| GET | `/admin/users` | `?q=, role=` | `User[]` | — |
| PATCH | `/admin/users/:id/status` | `{isActive}` | `User` (suspend/activate — suspended can't log in) | 403 |
| GET | `/admin/companies` | — | `Company[] + _count{users, jobs}` | — |
| GET | `/admin/jobs` | — | `Job[] + company + recruiter + _count.applications` | — |
| GET | `/admin/applications` | — | `Application[] + candidate + job` | — |
| DELETE | `/admin/jobs/:id` | — | `{ok:true}` — report workflow | 403, 404 |
| GET | `/admin/reports` | — | `Report[] + reporter + job` | — |
| PATCH | `/admin/reports/:id` | `{status}` | `Report` (OPEN→REVIEWED\|DISMISSED) | 403 |
| GET | `/admin/activity` | — | `ActivityLog[]` audit trail | — |

## Data notes

- **Statuses**: `APPLIED SCREENING SHORTLISTED INTERVIEW OFFER HIRED REJECTED WITHDRAWN` — staff moves forward; `WITHDRAWN` is candidate-only, `APPLIED` is entry-only.
- **Job lifecycle**: `DRAFT → PUBLISHED ⇄ PAUSED → CLOSED`; deadlines auto-hide postings and block applications.
- **AI endpoints**: every score/summary carries the "AI-generated estimate" contract — UI must label it; `OPENAI_API_KEY` unset → deterministic mock.
- **Files**: resume bytes live in object storage (key in DB); swap `STORAGE` provider for S3. Download is owner-or-receiving-company only.
