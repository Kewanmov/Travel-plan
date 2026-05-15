from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Trip, TripMember, Location, Task, BudgetItem, BudgetCategory, Currency, User
from schemas.trip import TripCreate, TripUpdate, TripVisibilityUpdate
from core.deps import get_current_user, check_trip_access

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("")
def get_trips(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    memberships = db.query(TripMember).filter(
        TripMember.user_id == current_user.id,
        TripMember.status  == "accepted",
    ).all()

    if not memberships:
        return {"success": True, "message": "OK", "data": []}

    trip_ids = [m.trip_id for m in memberships]

    trips = db.query(Trip).filter(Trip.id.in_(trip_ids)).all()
    trips_map = {t.id: t for t in trips}

    loc_aggregates = (
        db.query(
            Location.trip_id,
            func.count(Location.id),
            func.avg(Location.lat),
            func.avg(Location.lng),
        )
        .filter(Location.trip_id.in_(trip_ids))
        .group_by(Location.trip_id)
        .all()
    )
    loc_counts  = {r[0]: r[1] for r in loc_aggregates}
    loc_centers = {r[0]: (float(r[2]), float(r[3])) for r in loc_aggregates if r[2] is not None}

    task_totals = dict(
        db.query(Task.trip_id, func.count(Task.id))
        .filter(Task.trip_id.in_(trip_ids))
        .group_by(Task.trip_id)
        .all()
    )

    task_done_counts = dict(
        db.query(Task.trip_id, func.count(Task.id))
        .filter(Task.trip_id.in_(trip_ids), Task.is_done == 1)
        .group_by(Task.trip_id)
        .all()
    )

    member_counts = dict(
        db.query(TripMember.trip_id, func.count(TripMember.id))
        .filter(TripMember.trip_id.in_(trip_ids), TripMember.status == "accepted")
        .group_by(TripMember.trip_id)
        .all()
    )

    all_members = (
        db.query(TripMember, User)
        .join(User, User.id == TripMember.user_id)
        .filter(TripMember.trip_id.in_(trip_ids), TripMember.status == "accepted")
        .all()
    )

    members_by_trip = {}
    for tm, u in all_members:
        members_by_trip.setdefault(tm.trip_id, [])
        if len(members_by_trip[tm.trip_id]) < 5:
            members_by_trip[tm.trip_id].append({
                "id":     u.id,
                "name":   u.name,
                "avatar": u.avatar,
                "role":   tm.role,
            })

    role_map = {m.trip_id: m.role for m in memberships}

    result = []
    for trip in trips:
        center = loc_centers.get(trip.id)
        result.append({
            "id":              trip.id,
            "title":           trip.title,
            "city":            trip.city,
            "country":         trip.country,
            "date_start":      str(trip.date_start),
            "date_end":        str(trip.date_end),
            "cover_image":     trip.cover_image,
            "status":          trip.status,
            "role":            role_map.get(trip.id),
            "locations_count": loc_counts.get(trip.id, 0),
            "tasks_total":     task_totals.get(trip.id, 0),
            "tasks_done":      task_done_counts.get(trip.id, 0),
            "members_count":   member_counts.get(trip.id, 0),
            "members":         members_by_trip.get(trip.id, []),
            "currency_id":     trip.base_currency_id,
            "budget_limit":    float(trip.budget_limit) if trip.budget_limit else None,
            "center_lat":      center[0] if center else None,
            "center_lng":      center[1] if center else None,
        })

    return {"success": True, "message": "OK", "data": result}


@router.post("")
def create_trip(
    data:         TripCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if data.date_start > data.date_end:
        raise HTTPException(400, "Дата начала не может быть позже даты конца")

    trip = Trip(
        user_id          = current_user.id,
        title            = data.title,
        city             = data.city,
        country          = data.country,
        description      = data.description,
        date_start       = data.date_start,
        date_end         = data.date_end,
        base_currency_id = data.base_currency_id or 1,
        budget_limit     = data.budget_limit,
    )
    db.add(trip)
    db.flush()

    db.add(TripMember(
        trip_id    = trip.id,
        user_id    = current_user.id,
        role       = "owner",
        status     = "accepted",
        invited_by = current_user.id,
    ))
    db.commit()
    db.refresh(trip)

    return {
        "success": True,
        "message": "Поездка создана",
        "data": {
            "id":         trip.id,
            "title":      trip.title,
            "city":       trip.city,
            "date_start": str(trip.date_start),
            "date_end":   str(trip.date_end),
            "status":     trip.status,
        }
    }


@router.get("/{trip_id}")
def get_trip(
    trip_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Поездка не найдена")

    check_trip_access(trip_id, current_user.id, ["owner", "editor", "viewer"], db)

    membership = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
        TripMember.status  == "accepted",
    ).first()
    role = membership.role if membership else None

    all_members = (
        db.query(TripMember, User)
        .join(User, User.id == TripMember.user_id)
        .filter(TripMember.trip_id == trip_id, TripMember.status == "accepted")
        .all()
    )
    members_list = [
        {"id": u.id, "name": u.name, "email": u.email, "role": tm.role}
        for tm, u in all_members
    ]
    members_count = len(members_list)
    base_cur = db.query(Currency).filter(Currency.id == trip.base_currency_id).first()

    return {
        "success": True,
        "message": "OK",
        "data": {
            "id":               trip.id,
            "title":            trip.title,
            "city":             trip.city,
            "country":          trip.country,
            "description":      trip.description,
            "date_start":       str(trip.date_start),
            "date_end":         str(trip.date_end),
            "cover_image":      trip.cover_image,
            "status":           trip.status,
            "base_currency_id": trip.base_currency_id,
            "base_currency":    {"id": base_cur.id, "code": base_cur.code, "symbol": base_cur.symbol} if base_cur else None,
            "budget_limit":     float(trip.budget_limit) if trip.budget_limit else None,
            "is_public":        bool(trip.is_public),
            "role":             role,
            "members":          members_list,
            "members_count":    members_count,
        }
    }


@router.get("/{trip_id}/stats")
def get_trip_stats(
    trip_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(trip_id, current_user.id, ["owner", "editor", "viewer"], db)
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Поездка не найдена")

    cat_rows = (
        db.query(
            BudgetItem.category_id,
            func.coalesce(func.sum(BudgetItem.amount_in_base), 0),
            func.count(BudgetItem.id),
        )
        .filter(BudgetItem.trip_id == trip_id)
        .group_by(BudgetItem.category_id)
        .all()
    )
    cats = {c.id: c for c in db.query(BudgetCategory).all()}
    by_category = []
    for cat_id, total, cnt in cat_rows:
        cat = cats.get(cat_id) if cat_id else None
        by_category.append({
            "category_id": cat_id,
            "name":        cat.name  if cat else "Без категории",
            "color":       cat.color if cat else "#94a3b8",
            "total":       float(total or 0),
            "count":       int(cnt),
        })
    by_category.sort(key=lambda x: -x["total"])

    day_rows = (
        db.query(
            func.date(BudgetItem.created_at),
            func.coalesce(func.sum(BudgetItem.amount_in_base), 0),
        )
        .filter(BudgetItem.trip_id == trip_id)
        .group_by(func.date(BudgetItem.created_at))
        .order_by(func.date(BudgetItem.created_at))
        .all()
    )
    by_day = [{"date": str(d), "total": float(t or 0)} for d, t in day_rows]

    total_spent = sum(c["total"] for c in by_category)
    total_paid = float(
        db.query(func.coalesce(func.sum(BudgetItem.amount_in_base), 0))
        .filter(BudgetItem.trip_id == trip_id, BudgetItem.is_paid == 1)
        .scalar() or 0
    )

    tasks_total = db.query(func.count(Task.id)).filter(Task.trip_id == trip_id).scalar() or 0
    tasks_done  = db.query(func.count(Task.id)).filter(Task.trip_id == trip_id, Task.is_done == 1).scalar() or 0

    loc_total   = db.query(func.count(Location.id)).filter(Location.trip_id == trip_id).scalar() or 0

    base_cur = db.query(Currency).filter(Currency.id == trip.base_currency_id).first()

    return {
        "success": True, "message": "OK",
        "data": {
            "by_category":  by_category,
            "by_day":       by_day,
            "total_spent":  round(total_spent, 2),
            "total_paid":   round(total_paid, 2),
            "budget_limit": float(trip.budget_limit) if trip.budget_limit else None,
            "tasks": {"total": int(tasks_total), "done": int(tasks_done)},
            "locations":    int(loc_total),
            "currency": {
                "code":   base_cur.code   if base_cur else "RUB",
                "symbol": base_cur.symbol if base_cur else "₽",
            },
        },
    }


@router.patch("/{trip_id}/visibility")
def update_visibility(
    trip_id:      int,
    data:         TripVisibilityUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Поездка не найдена")
    check_trip_access(trip_id, current_user.id, ["owner"], db)
    trip.is_public = 1 if data.is_public else 0
    db.commit()
    return {
        "success": True,
        "message": "Видимость обновлена",
        "data": {"is_public": bool(trip.is_public)},
    }


@router.put("/{trip_id}")
def update_trip(
    trip_id:      int,
    data:         TripUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Поездка не найдена")

    check_trip_access(trip_id, current_user.id, ["owner", "editor"], db)

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(trip, field, value)

    if trip.date_start > trip.date_end:
        raise HTTPException(400, "Дата начала не может быть позже даты конца")

    db.commit()

    return {"success": True, "message": "Поездка обновлена", "data": {"id": trip.id}}


@router.delete("/{trip_id}")
def delete_trip(
    trip_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "Поездка не найдена")

    check_trip_access(trip_id, current_user.id, ["owner"], db)

    db.delete(trip)
    db.commit()

    return {"success": True, "message": "Поездка удалена", "data": {}}