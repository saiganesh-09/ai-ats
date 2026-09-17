# AI Governance — Limitations & Human Oversight

**AI in this system is decision-support, not decision-making.**
No automated action is ever taken on a candidate based on AI output.
Every AI feature produces a draft or an estimate that a human reviews,
edits, or ignores.

## The limitation, plainly

AI resume parsing, match scores, summaries, and interview questions are
*probabilistic estimates*. They can be wrong — they miss context, misread
formatting, and can reproduce bias present in their inputs or training data.
Nothing in this system may:

- Auto-reject, auto-shortlist, or auto-hire a candidate
- Rank candidates without a human choosing to view the ranking
- Change an application's status without a staff action

## What recruiters can always do

| Capability | Where |
|---|---|
| **Review the original resume** | Download button sits next to every AI panel — one click from any score |
| **Review extracted skills** | `parsed` JSON is shown on the resume page and merged into `candidate_skills`, which the candidate can edit directly |
| **Review AI information** | Match details (matched/missing/bands/explanation), summaries, and question banks are fully visible — nothing is a black-box number |
| **Override AI information** | Interview questions and summaries are **editable and persisted** — the AI drafts, the recruiter's edit is the record |
| **Ignore AI recommendations** | Scores are badges, not gates — pipeline moves, scheduling, and hiring work identically whether or not a score exists |

## Labeling contract

Every AI-generated surface carries the disclaimer:

> *"AI-generated matching estimate — review the original resume before
> making decisions."*

This appears on the insights panel header, under the score, and as a
tooltip on every score badge (kanban cards included).

## Sensitive-attribute policy

The matching engine (`mockScore` and the LLM prompt alike) scores on:

- **Skills** (matched/missing, required weighted double)
- **Experience** (qualitative band)
- **Education** (qualitative band)

It does **not** use name, photo, age, gender, ethnicity, address, or any
protected attribute for ranking — those fields aren't even passed to the
model for scoring. The prompt instructs output on skills/experience only,
and the deterministic mock's inputs are the skills arrays and education/
experience records.

## Data handling

- Resume text is sent to the AI provider only when `OPENAI_API_KEY` is set;
  otherwise everything runs on the local mock — no data leaves the machine.
- AI output is sanitized (`sanitizeParsed`) before storage — untrusted
  content is treated like any user input.
- `parsed`, `ai_summary`, `ai_questions`, `match_details` are stored as
  JSONB — auditable, replaceable, never hidden state.
