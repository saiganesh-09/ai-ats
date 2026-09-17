"""Shared FastAPI dependencies: DB session + authenticated user.

`get_current_user` and `require_role` are the building blocks every protected
route uses — this is where authentication and authorization actually happen.
"""
from typing import Annotated, Generator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User, UserRole
from .security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DB = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DB,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Decode the Bearer JWT, load the user, or 401."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.PyJWTError:
        raise unauthorized
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(role: UserRole):
    """Dependency factory: `Depends(require_role(UserRole.recruiter))`
    makes a route recruiter-only. Role checks live in the token AND are
    re-verified against the DB user here."""
    def checker(user: CurrentUser) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return checker
