# backend/routers/invitations.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Invitation, TripMember, User, Trip
from core.deps import get_current_user, check_trip_access
from routers.notifications import create_notification
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import secrets

router = APIRouter(prefix="/invitations", tags=["invitations"])

class InviteCreate(BaseModel):
    trip_id: int
    email:   EmailStr
    role:    str = "viewer"

class InviteAccept(BaseModel):
    token:  str
    action: str = "accept"

@router.post("")
def create_invitation(
    data:         InviteCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(data.trip_id, current_user.id, ["owner"], db)

    if data.role not in ["editor", "viewer"]:
        data.role = "viewer"

    invited_user = db.query(User).filter(User.email == data.email).first()
    if invited_user:
        existing = db.query(TripMember).filter(
            TripMember.trip_id == data.trip_id,
            TripMember.user_id == invited_user.id,
        ).first()
        if existing:
            raise HTTPException(400, "Пользователь уже в поездке")

    existing_invite = db.query(Invitation).filter(
        Invitation.trip_id == data.trip_id,
        Invitation.email   == data.email,
        Invitation.status  == "pending",
        Invitation.expires_at > datetime.utcnow(),
    ).first()

    if existing_invite:
        raise HTTPException(400, "Приглашение уже отправлено")

    token      = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)

    invitation = Invitation(
        trip_id    = data.trip_id,
        invited_by = current_user.id,
        email      = data.email,
        token      = token,
        role       = data.role,
        expires_at = expires_at,
    )
    db.add(invitation)

    if invited_user:
        trip = db.query(Trip).filter(Trip.id == data.trip_id).first()
        create_notification(
            db, invited_user.id, "trip_invite",
            title="Приглашение в поездку",
            message=f"{current_user.name} приглашает вас в «{trip.title if trip else 'поездку'}»",
            data={"trip_id": data.trip_id, "token": token, "role": data.role},
        )

    db.commit()

    return {"success": True, "message": "Приглашение создано", "data": {
        "token":       token,
        "invite_link": f"/invite.html?token={token}",
        "expires_at":  str(expires_at),
    }}

@router.post("/accept")
def accept_invitation(
    data:         InviteAccept,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    invitation = db.query(Invitation).filter(Invitation.token == data.token).first()

    if not invitation:
        raise HTTPException(404, "Приглашение не найдено")

    if invitation.status != "pending":
        raise HTTPException(400, "Приглашение уже использовано")

    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(400, "Срок действия приглашения истёк")

    if invitation.email != current_user.email:
        raise HTTPException(403, "Это приглашение предназначено для другого email")

    if data.action == "accept":
        existing = db.query(TripMember).filter(
            TripMember.trip_id == invitation.trip_id,
            TripMember.user_id == current_user.id,
        ).first()

        if existing:
            existing.status = "accepted"
            existing.role   = invitation.role
        else:
            member = TripMember(
                trip_id    = invitation.trip_id,
                user_id    = current_user.id,
                role       = invitation.role,
                status     = "accepted",
                invited_by = invitation.invited_by,
            )
            db.add(member)

        invitation.status      = "accepted"
        invitation.accepted_at = datetime.utcnow()

        trip = db.query(Trip).filter(Trip.id == invitation.trip_id).first()
        if trip and trip.user_id != current_user.id:
            create_notification(
                db, trip.user_id, "member_joined",
                title="Новый участник поездки",
                message=f"{current_user.name} присоединился к «{trip.title}»",
                data={"trip_id": trip.id, "user_id": current_user.id},
            )
        db.commit()

        return {"success": True, "message": "Вы присоединились к поездке", "data": {
            "trip_id": invitation.trip_id,
        }}
    else:
        invitation.status = "declined"
        db.commit()

        return {"success": True, "message": "Приглашение отклонено", "data": {}}