"""Password hashing and JWT creation/verification.

- pwdlib + argon2: current OWASP-recommended memory-hard hash. Never store
  plaintext passwords; verification is by re-hashing and comparing.
- JWT: stateless auth. Server signs {sub, role, exp} — no session table
  needed. The client sends it as `Authorization: Bearer <token>`.
"""
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from .config import settings

_password_hash = PasswordHash.recommended()  # argon2id


def hash_password(plain: str) -> str:
    return _password_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _password_hash.verify(plain, hashed)


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError (incl. ExpiredSignatureError) if invalid."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
