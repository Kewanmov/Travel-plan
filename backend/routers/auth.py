# backend/routers/auth.py
import os, secrets
from pathlib import Path
from fastapi import UploadFile, File
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from models import User, UserSettings
from schemas.user import UserRegister, UserLogin, UserUpdate, AccountDelete
from core.security import hash_password, verify_password, create_access_token
from core.deps import get_current_user
from core.ratelimit import rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])

_login_limit    = rate_limit("login",    limit=10, window_sec=300)
_register_limit = rate_limit("register", limit=5,  window_sec=3600)
_profile_limit  = rate_limit("profile",  limit=20, window_sec=3600)
_avatar_limit   = rate_limit("avatar",   limit=10, window_sec=3600)


@router.post("/register", dependencies=[Depends(_register_limit)])
def register(data: UserRegister, db: Session = Depends(get_db)):
    if len(data.name.strip()) < 2:
        raise HTTPException(400, "Имя слишком короткое")
    if len(data.password) < 8:
        raise HTTPException(400, "Пароль минимум 8 символов")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email уже используется")

    user = User(
        name=data.name.strip(),
        email=data.email,
        password=hash_password(data.password),
    )
    db.add(user)
    db.flush()

    db.add(UserSettings(user_id=user.id))
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})

    return {
        "success": True,
        "message": "Регистрация прошла успешно",
        "data": {
            "token": token,
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        }
    }


@router.post("/login", dependencies=[Depends(_login_limit)])
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == data.email,
        User.is_active == 1,
    ).first()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(400, "Неверный email или пароль")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id)})

    return {
        "success": True,
        "message": "Вход выполнен",
        "data": {
            "token": token,
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "avatar": user.avatar},
        }
    }


@router.post("/logout")
def logout():
    return {"success": True, "message": "Выход выполнен", "data": {}}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "message": "OK",
        "data": {"user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "avatar": current_user.avatar,
            "bio": current_user.bio,
            "phone": current_user.phone,
            "created_at": str(current_user.created_at),
            "last_login_at": str(current_user.last_login_at) if current_user.last_login_at else None,
        }}
    }


@router.put("/profile", dependencies=[Depends(_profile_limit)])
def update_profile(
    data: UserUpdate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        if len(data.name.strip()) < 2:
            raise HTTPException(400, "Имя слишком короткое")
        current_user.name = data.name.strip()

    if data.email is not None and data.email.lower() != (current_user.email or "").lower():
        existing = db.query(User).filter(
            User.email == data.email,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(400, "Этот email уже занят")
        current_user.email = data.email

    if data.bio is not None:
        current_user.bio = data.bio

    if data.phone is not None:
        current_user.phone = data.phone

    if data.password:
        if not data.old_password:
            raise HTTPException(400, "Укажи текущий пароль")
        if not verify_password(data.old_password, current_user.password):
            raise HTTPException(400, "Неверный текущий пароль")
        if len(data.password) < 8:
            raise HTTPException(400, "Новый пароль минимум 8 символов")
        current_user.password = hash_password(data.password)

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "message": "Профиль обновлён",
        "data": {"user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "avatar": current_user.avatar,
            "bio": current_user.bio,
            "phone": current_user.phone,
        }}
    }


AVATAR_DIR = Path(__file__).resolve().parent.parent / "uploads" / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
AVATAR_MAX = 4 * 1024 * 1024
AVATAR_MIME_EXT = {
    "image/jpeg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif",
}


@router.post("/avatar", dependencies=[Depends(_avatar_limit)])
async def upload_avatar(
    file:         UploadFile = File(...),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    mime = (file.content_type or "").lower()
    if mime not in AVATAR_MIME_EXT:
        raise HTTPException(415, "Только JPG, PNG, WebP или GIF")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Пустой файл")
    if len(data) > AVATAR_MAX:
        raise HTTPException(413, f"Файл больше {AVATAR_MAX // 1024 // 1024} МБ")

    name = f"u{current_user.id}_" + secrets.token_urlsafe(12).replace("_", "").replace("-", "") + AVATAR_MIME_EXT[mime]
    (AVATAR_DIR / name).write_bytes(data)

    if current_user.avatar:
        old = AVATAR_DIR / Path(current_user.avatar).name
        try:
            if old.exists() and current_user.avatar.startswith("/uploads/avatars/"):
                old.unlink()
        except OSError:
            pass

    current_user.avatar = f"/uploads/avatars/{name}"
    db.commit()
    return {
        "success": True, "message": "Аватар обновлён",
        "data": {"avatar": current_user.avatar},
    }


@router.delete("/avatar")
def delete_avatar(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if current_user.avatar and current_user.avatar.startswith("/uploads/avatars/"):
        try:
            (AVATAR_DIR / Path(current_user.avatar).name).unlink(missing_ok=True)
        except OSError:
            pass
    current_user.avatar = None
    db.commit()
    return {"success": True, "message": "Аватар удалён", "data": {}}


@router.delete("/account")
def delete_account(
    data:         AccountDelete,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if not verify_password(data.password, current_user.password):
        raise HTTPException(400, "Неверный пароль")

    db.delete(current_user)
    db.commit()
    return {"success": True, "message": "Аккаунт удалён", "data": {}}