import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthSession, User


SESSION_LIFETIME = timedelta(days=30)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_text, digest_text = stored_hash.split(":", 1)
        salt = base64.b64decode(salt_text)
        expected = base64.b64decode(digest_text)
    except (ValueError, TypeError):
        return False
    actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(actual, expected)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash(token),
            expires_at=datetime.utcnow() + SESSION_LIFETIME,
        )
    )
    db.commit()
    return token


def bearer_token(request: Request) -> str:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
    return token


def get_current_user(
    token: str = Depends(bearer_token), db: Session = Depends(get_db)
) -> User:
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash(token),
            AuthSession.expires_at > datetime.utcnow(),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return session.user