# AI Features

One service — `backend/src/ai/ai.service.ts` — fronts every AI capability.
`OPENAI_API_KEY` set → OpenAI `gpt-4o-mini` with structured-JSON prompts;
unset → a deterministic heuristic mock. Same interface, so tests, dev, and
CI never need a key.

## Feature map

| Feature | Trigger | Output | Persisted |
|---|---|---|---|
| Resume parsing | `POST /resumes` (on upload) | name, email, phone, skills, education, experience, certifications, projects | `resumes.parsed` JSONB |
| Skill extraction | automatic (parse + job create) | canonical skill names → `candidate_skills`/`job_skills` joins | normalized tables |
| Match scoring | `POST /applications/:id/score` | score + matched/missing skills + experience & education bands + explanation | `matchScore`, `matchDetails` |
| Candidate summary | `POST /applications/:id/summarize` | 6-section structured summary | `aiSummary` JSONB |
| Interview questions | `POST /applications/:id/questions` | 5 categories (technical/behavioral/project/role/situational) | `aiQuestions` JSONB — editable |
| JD analysis | `POST /jobs/:id/analyze` | required skills, seniority, clarity score | transient |

## Design decisions

- **Sanitize before storing** — `sanitizeParsed()` strips HTML, whitelists
  fields, validates contact formats, dedupes skills. LLM output is
  untrusted input.
- **AI drafts, humans decide** — questions/summaries persist so recruiters
  edit them; scores are labeled "AI-generated estimate" everywhere with the
  original resume one click away.
- **Mock = contract** — the mock returns the exact same JSON shape as the
  prompt asks for, so the provider swap is invisible to callers.
- **Fire-and-forget failure** — `tryAi()` falls back to the mock on any
  OpenAI error and logs a warning; AI outage never breaks a request.

## Governance

Full limitation + oversight policy: [AI-GOVERNANCE.md](AI-GOVERNANCE.md).
Short version: no automated decisions, everything reviewable/overridable,
no sensitive attributes used for ranking.
