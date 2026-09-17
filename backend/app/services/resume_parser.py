"""Extract raw text from uploaded resume files (PDF or plain text)."""
import io

from pypdf import PdfReader


class UnsupportedFileError(Exception):
    pass


def extract_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return _extract_pdf(content)
    if name.endswith(".txt"):
        return content.decode("utf-8", errors="replace")
    raise UnsupportedFileError("Only .pdf and .txt resumes are supported")


def _extract_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not text.strip():
        raise UnsupportedFileError("Could not extract text (scanned/image-only PDF?)")
    return text
