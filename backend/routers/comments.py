from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from models import TripComment, User, Trip, TripMember
from core.deps import get_current_user, check_trip_access
from routers.notifications import create_notification

router = APIRouter(prefix="/comments", tags=["comments"])


class CommentCreate(BaseModel):
    trip_id: int = Field(ge=1)
    content: str = Field(min_length=1, max_length=2000)


class CommentUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


def _serialize(c: TripComment, user: User | None) -> dict:
    return {
        "id":         c.id,
        "trip_id":    c.trip_id,
        "user_id":    c.user_id,
        "user_name":  user.name   if user else "—",
        "user_email": user.email  if user else None,
        "content":    c.content,
        "is_edited":  bool(c.is_edited),
        "created_at": str(c.created_at) if c.created_at else None,
        "updated_at": str(c.updated_at) if c.updated_at else None,
    }


@router.get("")
def list_comments(
    trip_id:      int = Query(..., ge=1),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(trip_id, current_user.id, ["owner", "editor", "viewer"], db)

    rows = (
        db.query(TripComment, User)
        .join(User, User.id == TripComment.user_id)
        .filter(TripComment.trip_id == trip_id)
        .order_by(TripComment.created_at.asc())
        .all()
    )
    return {"success": True, "message": "OK",
            "data": [_serialize(c, u) for c, u in rows]}


@router.post("")
def create_comment(
    data:         CommentCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(data.trip_id, current_user.id, ["owner", "editor", "viewer"], db)

    c = TripComment(
        trip_id = data.trip_id,
        user_id = current_user.id,
        content = data.content.strip(),
    )
    db.add(c)
    db.flush()

    # Уведомление другим участникам поездки
    trip = db.query(Trip).filter(Trip.id == data.trip_id).first()
    member_ids = [
        uid for (uid,) in db.query(TripMember.user_id)
        .filter(TripMember.trip_id == data.trip_id, TripMember.status == "accepted")
        .all()
        if uid != current_user.id
    ]
    short = (data.content[:80] + "…") if len(data.content) > 80 else data.content
    for uid in member_ids:
        create_notification(
            db, uid, "trip_update",
            title="Новый комментарий",
            message=f"{current_user.name}" + (f" в «{trip.title}»: " if trip else ": ") + short,
            data={"trip_id": data.trip_id, "comment_id": c.id},
        )

    db.commit()
    db.refresh(c)
    return {"success": True, "message": "Комментарий добавлен",
            "data": _serialize(c, current_user)}


@router.put("/{comment_id}")
def update_comment(
    comment_id:   int,
    data:         CommentUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    c = db.query(TripComment).filter(TripComment.id == comment_id).first()
    if not c:
        raise HTTPException(404, "Комментарий не найден")
    if c.user_id != current_user.id:
        raise HTTPException(403, "Можно редактировать только свои комментарии")

    c.content   = data.content.strip()
    c.is_edited = 1
    db.commit()
    db.refresh(c)
    return {"success": True, "message": "Обновлено",
            "data": _serialize(c, current_user)}


@router.delete("/{comment_id}")
def delete_comment(
    comment_id:   int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    c = db.query(TripComment).filter(TripComment.id == comment_id).first()
    if not c:
        raise HTTPException(404, "Комментарий не найден")

    if c.user_id != current_user.id:
        # owner поездки тоже может удалить
        trip = db.query(Trip).filter(Trip.id == c.trip_id).first()
        if not trip or trip.user_id != current_user.id:
            raise HTTPException(403, "Удалить может автор или владелец поездки")

    db.delete(c)
    db.commit()
    return {"success": True, "message": "Удалено", "data": {}}