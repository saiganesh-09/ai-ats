"""FastAPI app entrypoint.

Run: uvicorn app.main:app --reload
Interactive API docs (free, auto-generated): http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import applications, auth, jobs, resumes

app = FastAPI(title="AI ATS API", version="0.1.0")

# CORS: the React dev server (port 5173) is a different origin than the API
# (port 8000), so the browser requires these headers to allow the calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(resumes.router)
app.include_router(applications.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "ai": "openai" if settings.openai_api_key else "mock"}
