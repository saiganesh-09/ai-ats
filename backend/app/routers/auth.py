"""Auth routes: register, login, current user."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DB
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DB):
    exists = db.scalar(select(User).where(User.email == body.email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(
        access_token=create_access_token(user.id, user.role.value),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DB):
    user = db.scalar(select(User).where(User.email == body.email))
    # Same error for "no user" and "wrong password" — don't leak which failed.
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return TokenOut(
        access_token=create_access_token(user.id, user.role.value),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
