import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from server import config
from server.db import get_db
from server.deps import current_user
from server.models import User
from server.schemas import Credentials, TokenOut, UserOut
from server.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Small in-memory throttle against password guessing (per email + client IP; resets on restart).
_failures: dict[str, deque] = defaultdict(deque)


def _throttle_key(email: str, request: Request) -> str:
    return f"{email}|{request.client.host if request.client else '?'}"


def _check_throttle(key: str) -> None:
    q, cutoff = _failures[key], time.time() - config.LOGIN_WINDOW_SECONDS
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= config.LOGIN_MAX_FAILURES:
        raise HTTPException(429, "Too many failed sign-in attempts. Try again in a few minutes.")


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: Credentials, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(409, "An account with this email already exists.")
    first_user = db.scalar(select(func.count()).select_from(User)) == 0
    role = "admin" if first_user or body.email in config.ADMIN_EMAILS else "user"
    user = User(email=body.email, password_hash=hash_password(body.password), role=role)
    db.add(user)
    db.commit()
    return TokenOut(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, request: Request, db: Session = Depends(get_db)):
    key = _throttle_key(body.email, request)
    _check_throttle(key)
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        _failures[key].append(time.time())
        raise HTTPException(401, "Email or password is incorrect.")
    _failures.pop(key, None)
    return TokenOut(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
