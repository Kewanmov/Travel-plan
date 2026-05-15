# backend/routers/notifications.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from database import get_db
from models import Notification, User
from core.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(n: Notification) -> dict:
    return {
        "id":         n.id,
        "type":       n.type,
        "title":      n.title,
        "message":    n.message,
        "data":       n.data,
        "is_read":    bool(n.is_read),
        "created_at": str(n.created_at) if n.created_at else None,
    }


@router.get("")
def list_notifications(
    only_unread: bool = Query(False),
    limit:       int  = Query(20, ge=1, le=100),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if only_unread:
        q = q.filter(Notification.is_read == 0)
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return {
        "success": True, "message": "OK",
        "data": [_serialize(n) for n in rows],
    }


@router.get("/unread-count")
def unread_count(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    cnt = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == current_user.id, Notification.is_read == 0)
        .scalar() or 0
    )
    return {"success": True, "message": "OK", "data": {"count": int(cnt)}}


@router.post("/{notif_id}/read")
def mark_read(
    notif_id:     int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(404, "Уведомление не найдено")
    n.is_read = 1
    db.commit()
    return {"success": True, "message": "OK", "data": {}}


@router.post("/read-all")
def mark_all_read(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == 0)
        .update({Notification.is_read: 1}, synchronize_session=False)
    )
    db.commit()
    return {"success": True, "message": "OK", "data": {}}


@router.delete("/{notif_id}")
def delete_notification(
    notif_id:     int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(404, "Уведомление не найдено")
    db.delete(n)
    db.commit()
    return {"success": True, "message": "OK", "data": {}}


def create_notification(
    db: Session,
    user_id: int,
    type_: str,
    title: str,
    message: str | None = None,
    data: dict | None = None,
) -> None:
    if not user_id:
        return
    n = Notification(
        user_id=user_id, type=type_, title=title,
        message=message, data=data, is_read=0,
    )
    db.add(n)