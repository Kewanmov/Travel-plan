# backend/routers/admin.py
import csv, io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database import get_db
from models import User, Trip, TripMember, Location, Task, BudgetItem, Currency, Attachment
from core.deps import get_admin_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/live")
def live_metrics(
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    now    = datetime.utcnow()
    day_ago = now - timedelta(hours=24)

    online_24h = db.query(func.count(User.id)).filter(User.last_login_at >= day_ago).scalar() or 0
    new_users  = db.query(func.count(User.id)).filter(User.created_at  >= day_ago).scalar() or 0
    new_trips  = db.query(func.count(Trip.id)).filter(Trip.created_at  >= day_ago).scalar() or 0
    new_spent  = float(db.query(func.coalesce(func.sum(BudgetItem.amount_in_base), 0))
                       .filter(BudgetItem.created_at >= day_ago).scalar() or 0)

    storage = db.query(
        func.count(Attachment.id),
        func.coalesce(func.sum(Attachment.size_bytes), 0),
    ).first()
    storage_count = int(storage[0] or 0)
    storage_bytes = int(storage[1] or 0)

    return {"success": True, "message": "OK", "data": {
        "online_24h":    online_24h,
        "new_users_24h": new_users,
        "new_trips_24h": new_trips,
        "spent_24h":     round(new_spent, 2),
        "storage_count": storage_count,
        "storage_bytes": storage_bytes,
    }}


def _csv_response(rows: list[list], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    buf.write("﻿")  # BOM, чтоб Excel корректно читал кириллицу
    w = csv.writer(buf, delimiter=";")
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/users.csv")
def export_users_csv(
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    rows = [["id", "name", "email", "role", "is_active", "created_at", "last_login_at"]]
    for u in db.query(User).order_by(User.id).all():
        rows.append([
            u.id, u.name, u.email, u.role,
            "yes" if u.is_active else "no",
            str(u.created_at) if u.created_at else "",
            str(u.last_login_at) if u.last_login_at else "",
        ])
    return _csv_response(rows, "users.csv")


@router.get("/export/trips.csv")
def export_trips_csv(
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    rows = [["id", "title", "city", "country", "owner_email", "date_start", "date_end",
             "status", "is_public", "budget_limit", "created_at"]]
    q = (db.query(Trip, User)
         .outerjoin(User, User.id == Trip.user_id)
         .order_by(Trip.id))
    for t, owner in q.all():
        rows.append([
            t.id, t.title, t.city, t.country or "",
            owner.email if owner else "",
            str(t.date_start), str(t.date_end),
            t.status, "yes" if t.is_public else "no",
            float(t.budget_limit) if t.budget_limit else "",
            str(t.created_at) if t.created_at else "",
        ])
    return _csv_response(rows, "trips.csv")


@router.get("/export/budget.csv")
def export_budget_csv(
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    rows = [["id", "trip_id", "title", "amount", "currency_id", "amount_in_base",
             "is_paid", "category_id", "created_at"]]
    for b in db.query(BudgetItem).order_by(BudgetItem.id).all():
        rows.append([
            b.id, b.trip_id, b.title,
            float(b.amount), b.currency_id,
            float(b.amount_in_base or 0),
            "yes" if b.is_paid else "no",
            b.category_id or "",
            str(b.created_at) if b.created_at else "",
        ])
    return _csv_response(rows, "budget.csv")


@router.get("/stats")
def get_stats(
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    total_users     = db.query(func.count(User.id)).scalar()
    active_users    = db.query(func.count(User.id)).filter(User.is_active == 1).scalar()
    total_trips     = db.query(func.count(Trip.id)).scalar()
    active_trips    = db.query(func.count(Trip.id)).filter(Trip.status == "active").scalar()
    total_locations = db.query(func.count(Location.id)).scalar()
    total_tasks     = db.query(func.count(Task.id)).scalar()
    done_tasks      = db.query(func.count(Task.id)).filter(Task.is_done == 1).scalar()
    total_budget    = db.query(func.count(BudgetItem.id)).scalar()
    total_spent     = db.query(func.sum(BudgetItem.amount_in_base)).scalar() or 0

    users_by_day = db.execute(text("""
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM users
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
    """)).fetchall()

    trips_by_day = db.execute(text("""
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM trips
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
    """)).fetchall()

    top_cities = db.execute(text("""
        SELECT city, COUNT(*) AS count
        FROM trips
        GROUP BY city
        ORDER BY count DESC
        LIMIT 10
    """)).fetchall()

    budget_by_cat = db.execute(text("""
        SELECT bc.name, bc.color, COALESCE(SUM(bi.amount_in_base), 0) AS total
        FROM budget_categories bc
        LEFT JOIN budget_items bi ON bi.category_id = bc.id
        GROUP BY bc.id
        ORDER BY total DESC
    """)).fetchall()

    return {
        "success": True,
        "message": "OK",
        "data": {
            "stats": {
                "total_users":        total_users,
                "active_users":       active_users,
                "total_trips":        total_trips,
                "active_trips":       active_trips,
                "total_locations":    total_locations,
                "total_tasks":        total_tasks,
                "done_tasks":         done_tasks,
                "total_budget_items": total_budget,
                "total_spent":        float(total_spent),
            },
            "users_by_day":       [{"day": str(r[0]), "count": r[1]} for r in users_by_day],
            "trips_by_day":       [{"day": str(r[0]), "count": r[1]} for r in trips_by_day],
            "top_cities":         [{"city": r[0], "count": r[1]} for r in top_cities],
            "budget_by_category": [{"name": r[0], "color": r[1], "total": float(r[2])} for r in budget_by_cat],
        }
    }


@router.get("/users")
def get_users(
    page:   int           = Query(1, ge=1),
    search: Optional[str] = Query(None),
    role:   Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    limit  = 20
    offset = (page - 1) * limit
    query  = db.query(User)

    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    if role:
        query = query.filter(User.role == role)
    if status == "active":
        query = query.filter(User.is_active == 1)
    elif status == "blocked":
        query = query.filter(User.is_active == 0)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    user_ids = [u.id for u in users]

    trips_counts = dict(
        db.query(TripMember.user_id, func.count(TripMember.id))
        .filter(TripMember.user_id.in_(user_ids), TripMember.role == "owner")
        .group_by(TripMember.user_id)
        .all()
    )

    result = [
        {
            "id":            u.id,
            "name":          u.name,
            "email":         u.email,
            "role":          u.role,
            "is_active":     u.is_active,
            "avatar":        u.avatar,
            "trips_count":   trips_counts.get(u.id, 0),
            "created_at":    str(u.created_at),
            "last_login_at": str(u.last_login_at) if u.last_login_at else None,
        }
        for u in users
    ]

    return {
        "success": True,
        "message": "OK",
        "data": {
            "users":       result,
            "total":       total,
            "page":        page,
            "total_pages": (total + limit - 1) // limit,
        }
    }


class UserAdminUpdate(BaseModel):
    name:      Optional[str] = None
    role:      Optional[str] = None
    is_active: Optional[int] = None


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data:    UserAdminUpdate,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    if data.name is not None:
        if len(data.name.strip()) < 2:
            raise HTTPException(400, "Имя слишком короткое")
        user.name = data.name.strip()

    if data.role is not None:
        if data.role not in ("user", "admin"):
            raise HTTPException(400, "Недопустимая роль")
        user.role = data.role

    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()

    return {"success": True, "message": "Пользователь обновлён", "data": {}}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    if user.id == admin_user.id:
        raise HTTPException(400, "Нельзя удалить себя")

    db.delete(user)
    db.commit()

    return {"success": True, "message": "Пользователь удалён", "data": {}}


@router.get("/trips")
def get_trips_admin(
    page:   int           = Query(1, ge=1),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    limit  = 20
    offset = (page - 1) * limit
    query  = db.query(Trip)

    if search:
        query = query.filter(
            (Trip.title.ilike(f"%{search}%")) |
            (Trip.city.ilike(f"%{search}%"))
        )
    if status:
        query = query.filter(Trip.status == status)

    total = query.count()
    trips = query.order_by(Trip.created_at.desc()).offset(offset).limit(limit).all()

    trip_ids = [t.id for t in trips]
    user_ids = list({t.user_id for t in trips})

    owners = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    members_counts = dict(
        db.query(TripMember.trip_id, func.count(TripMember.id))
        .filter(TripMember.trip_id.in_(trip_ids), TripMember.status == "accepted")
        .group_by(TripMember.trip_id)
        .all()
    )

    loc_counts = dict(
        db.query(Location.trip_id, func.count(Location.id))
        .filter(Location.trip_id.in_(trip_ids))
        .group_by(Location.trip_id)
        .all()
    )

    task_counts = dict(
        db.query(Task.trip_id, func.count(Task.id))
        .filter(Task.trip_id.in_(trip_ids))
        .group_by(Task.trip_id)
        .all()
    )

    result = []
    for t in trips:
        owner = owners.get(t.user_id)
        result.append({
            "id":              t.id,
            "title":           t.title,
            "city":            t.city,
            "country":         t.country,
            "date_start":      str(t.date_start),
            "date_end":        str(t.date_end),
            "status":          t.status,
            "created_at":      str(t.created_at),
            "owner_name":      owner.name  if owner else "—",
            "owner_email":     owner.email if owner else "—",
            "members_count":   members_counts.get(t.id, 0),
            "locations_count": loc_counts.get(t.id, 0),
            "tasks_count":     task_counts.get(t.id, 0),
        })

    return {
        "success": True,
        "message": "OK",
        "data": {
            "trips":       result,
            "total":       total,
            "page":        page,
            "total_pages": (total + limit - 1) // limit,
        }
    }


@router.delete("/trips/{trip_id}")
def delete_trip_admin(
    trip_id: int,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Поездка не найдена")

    db.delete(trip)
    db.commit()

    return {"success": True, "message": "Поездка удалена", "data": {}}


@router.get("/locations")
def get_locations_admin(
    page:    int           = Query(1, ge=1),
    search:  Optional[str] = Query(None),
    trip_id: Optional[int] = Query(None),
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    limit  = 20
    offset = (page - 1) * limit
    query  = db.query(Location)

    if search:
        query = query.filter(Location.name.ilike(f"%{search}%"))
    if trip_id:
        query = query.filter(Location.trip_id == trip_id)

    total     = query.count()
    locations = query.order_by(Location.created_at.desc()).offset(offset).limit(limit).all()

    loc_ids  = [loc.id for loc in locations]
    trip_ids = list({loc.trip_id for loc in locations})
    user_ids = list({loc.added_by for loc in locations})

    trips_map = {t.id: t for t in db.query(Trip).filter(Trip.id.in_(trip_ids)).all()}
    users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    result = []
    for loc in locations:
        trip     = trips_map.get(loc.trip_id)
        added_by = users_map.get(loc.added_by)
        result.append({
            "id":          loc.id,
            "trip_id":     loc.trip_id,
            "trip_title":  trip.title if trip else "—",
            "name":        loc.name,
            "address":     loc.address,
            "lat":         float(loc.lat),
            "lng":         float(loc.lng),
            "category_id": loc.category_id,
            "note":        loc.note,
            "added_by":    added_by.name if added_by else "—",
            "created_at":  str(loc.created_at),
        })

    return {
        "success": True,
        "message": "OK",
        "data": {
            "locations":   result,
            "total":       total,
            "page":        page,
            "total_pages": (total + limit - 1) // limit,
        }
    }


@router.delete("/locations/{location_id}")
def delete_location_admin(
    location_id: int,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(404, "Локация не найдена")

    db.delete(location)
    db.commit()

    return {"success": True, "message": "Локация удалена", "data": {}}


@router.get("/currencies")
def get_currencies_admin(
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    currencies = db.query(Currency).order_by(Currency.id).all()

    return {
        "success": True,
        "message": "OK",
        "data": [
            {
                "id":          c.id,
                "code":        c.code,
                "name":        c.name,
                "symbol":      c.symbol,
                "rate_to_rub": float(c.rate_to_rub),
                "is_active":   c.is_active,
                "updated_at":  str(c.updated_at),
            }
            for c in currencies
        ]
    }


class CurrencyUpdate(BaseModel):
    rate_to_rub: float
    is_active:   Optional[int] = None


@router.put("/currencies/{currency_id}")
def update_currency(
    currency_id: int,
    data:        CurrencyUpdate,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(404, "Валюта не найдена")

    if data.rate_to_rub <= 0:
        raise HTTPException(400, "Курс должен быть больше 0")

    currency.rate_to_rub = data.rate_to_rub

    if data.is_active is not None:
        currency.is_active = data.is_active

    db.commit()

    return {"success": True, "message": "Курс обновлён", "data": {}}


ALLOWED_NOTIF_TYPES = [
    "trip_invite", "trip_update", "member_joined", "member_left",
    "task_assigned", "task_done", "budget_limit", "trip_reminder",
]


@router.get("/notifications")
def get_notifications_admin(
    page:    int           = Query(1, ge=1),
    user_id: Optional[int] = Query(None),
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    limit  = 20
    offset = (page - 1) * limit

    if user_id:
        where  = "WHERE n.user_id = :user_id"
        params = {"user_id": user_id, "limit": limit, "offset": offset}
    else:
        where  = ""
        params = {"limit": limit, "offset": offset}

    total_row = db.execute(
        text(f"SELECT COUNT(*) FROM notifications n {where}"),
        params
    ).fetchone()
    total = total_row[0] if total_row else 0

    rows = db.execute(text(f"""
        SELECT n.id, n.user_id, u.name AS user_name,
               n.type, n.title, n.message, n.is_read, n.created_at
        FROM notifications n
        LEFT JOIN users u ON u.id = n.user_id
        {where}
        ORDER BY n.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    result = [
        {
            "id":         r[0],
            "user_id":    r[1],
            "user_name":  r[2] or "—",
            "type":       r[3],
            "title":      r[4],
            "message":    r[5],
            "is_read":    bool(r[6]),
            "created_at": str(r[7]),
        }
        for r in rows
    ]

    return {
        "success": True,
        "message": "OK",
        "data": {
            "notifications": result,
            "total":         total,
            "page":          page,
            "total_pages":   (total + limit - 1) // limit,
        }
    }


class NotificationCreate(BaseModel):
    user_id: Optional[int] = None
    type:    str
    title:   str
    message: Optional[str] = None


@router.post("/notifications")
def create_notification_admin(
    data: NotificationCreate,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    if data.type not in ALLOWED_NOTIF_TYPES:
        raise HTTPException(400, "Недопустимый тип уведомления")

    if not data.title or not data.title.strip():
        raise HTTPException(400, "Заголовок обязателен")

    if data.user_id is None:
        users = db.query(User).filter(User.is_active == 1).all()
        for u in users:
            db.execute(text("""
                INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
                VALUES (:user_id, :type, :title, :message, 0, NOW())
            """), {
                "user_id": u.id,
                "type":    data.type,
                "title":   data.title.strip(),
                "message": data.message or None,
            })
    else:
        target = db.query(User).filter(User.id == data.user_id).first()
        if not target:
            raise HTTPException(404, "Пользователь не найден")

        db.execute(text("""
            INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
            VALUES (:user_id, :type, :title, :message, 0, NOW())
        """), {
            "user_id": data.user_id,
            "type":    data.type,
            "title":   data.title.strip(),
            "message": data.message or None,
        })

    db.commit()

    return {"success": True, "message": "Уведомление отправлено", "data": {}}


@router.delete("/notifications/{notification_id}")
def delete_notification_admin(
    notification_id: int,
    db:         Session = Depends(get_db),
    admin_user: User    = Depends(get_admin_user),
):
    row = db.execute(
        text("SELECT id FROM notifications WHERE id = :id"),
        {"id": notification_id}
    ).fetchone()

    if not row:
        raise HTTPException(404, "Уведомление не найдено")

    db.execute(
        text("DELETE FROM notifications WHERE id = :id"),
        {"id": notification_id}
    )
    db.commit()

    return {"success": True, "message": "Уведомление удалено", "data": {}}