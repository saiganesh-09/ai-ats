"""AI service: resume parsing and job-match scoring.

Two interchangeable implementations behind plain functions:
- OpenAI: sends extracted resume text to the model, asks for strict JSON back.
- Mock: deterministic keyword heuristics. Used automatically when
  OPENAI_API_KEY is unset, and in tests, so the app works offline/free.

Keeping this behind one module means the routers never care which
implementation ran — a simple Strategy pattern.
"""
import json
import re

from openai import OpenAI

from ..config import settings

PARSE_PROMPT = """You are an ATS resume parser. Extract structured data from the
resume text below. Respond with ONLY valid JSON in exactly this shape:
{{
  "summary": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{{"title": "...", "company": "...", "years": 2, "highlights": ["..."]}}],
  "education": [{{"degree": "...", "institution": "...", "year": 2020}}]
}}

RESUME TEXT:
{text}"""

SCORE_PROMPT = """You are an ATS matching engine. Score how well this candidate's
parsed resume matches the job. Respond with ONLY valid JSON in this shape:
{{
  "score": 0-100,
  "matched_skills": ["..."],
  "missing_skills": ["..."],
  "explanation": "2-3 sentences justifying the score"
}}

JOB TITLE: {title}
JOB DESCRIPTION: {description}
JOB REQUIREMENTS: {requirements}

PARSED RESUME: {resume}"""

# Common skills vocabulary for the mock parser/scorer.
_SKILLS = [
    "python", "javascript", "typescript", "react", "node", "fastapi", "django",
    "flask", "sql", "postgresql", "mysql", "mongodb", "redis", "docker",
    "kubernetes", "aws", "gcp", "azure", "git", "ci/cd", "rest", "graphql",
    "machine learning", "tensorflow", "pytorch", "pandas", "numpy", "java",
    "go", "rust", "c++", "html", "css", "tailwind", "linux", "agile",
]


def _client() -> OpenAI | None:
    if not settings.openai_api_key:
        return None
    return OpenAI(api_key=settings.openai_api_key)


def _chat_json(client: OpenAI, prompt: str) -> dict:
    resp = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return json.loads(resp.choices[0].message.content)


def parse_resume(raw_text: str) -> dict:
    """Raw resume text -> structured profile dict."""
    client = _client()
    if client is None:
        return _mock_parse(raw_text)
    try:
        return _chat_json(client, PARSE_PROMPT.format(text=raw_text[:12000]))
    except Exception:
        # AI is an enhancement, not a hard dependency — degrade gracefully.
        return _mock_parse(raw_text)


def score_match(parsed_resume: dict, title: str, description: str, requirements: str | None) -> dict:
    """Parsed resume + job -> {score, matched_skills, missing_skills, explanation}."""
    client = _client()
    if client is None:
        return _mock_score(parsed_resume, description, requirements)
    try:
        return _chat_json(
            client,
            SCORE_PROMPT.format(
                title=title,
                description=description[:6000],
                requirements=requirements or "N/A",
                resume=json.dumps(parsed_resume)[:6000],
            ),
        )
    except Exception:
        return _mock_score(parsed_resume, description, requirements)


# ---------- mock implementation (no API key needed) ----------

def _found_skills(text: str) -> list[str]:
    lowered = text.lower()
    return [s for s in _SKILLS if re.search(rf"\b{re.escape(s)}\b", lowered)]


def _mock_parse(raw_text: str) -> dict:
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    return {
        "summary": (lines[0][:300] if lines else "No summary extracted"),
        "skills": _found_skills(raw_text),
        "experience": [],
        "education": [],
        "_parser": "mock",
    }


def _mock_score(parsed_resume: dict, description: str, requirements: str | None) -> dict:
    job_text = f"{description} {requirements or ''}"
    job_skills = set(_found_skills(job_text))
    resume_skills = set(s.lower() for s in parsed_resume.get("skills", []))
    matched = sorted(job_skills & resume_skills)
    missing = sorted(job_skills - resume_skills)
    score = round(100 * len(matched) / len(job_skills)) if job_skills else 50
    return {
        "score": score,
        "matched_skills": matched,
        "missing_skills": missing,
        "explanation": (
            f"Heuristic match: candidate has {len(matched)} of {len(job_skills)} "
            "skills mentioned in the job posting."
        ),
    }
