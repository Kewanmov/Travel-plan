from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import BudgetItem, Currency, Trip, User
from schemas.budget import BudgetItemCreate, BudgetItemUpdate
from core.deps import get_current_user, check_trip_access
from datetime import datetime

router = APIRouter(prefix="/budget", tags=["budget"])

def calc_amount_in_base(db, trip_id, amount, currency_id):
    trip     = db.query(Trip).filter(Trip.id == trip_id).first()
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    base_cur = db.query(Currency).filter(Currency.id == trip.base_currency_id).first()

    if not currency or not base_cur:
        return amount

    amount_in_rub  = float(amount) * float(currency.rate_to_rub)
    amount_in_base = amount_in_rub / float(base_cur.rate_to_rub)
    return round(amount_in_base, 2)

@router.get("")
def get_budget(
    trip_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(trip_id, current_user.id, ["owner", "editor", "viewer"], db)

    items = db.query(BudgetItem).filter(BudgetItem.trip_id == trip_id).order_by(BudgetItem.created_at.desc()).all()

    total     = sum(float(i.amount_in_base or 0) for i in items)
    total_paid= sum(float(i.amount_in_base or 0) for i in items if i.is_paid)

    by_category = {}
    for item in items:
        key = item.category_id or 0
        if key not in by_category:
            by_category[key] = 0
        by_category[key] += float(item.amount_in_base or 0)

    trip     = db.query(Trip).filter(Trip.id == trip_id).first()
    base_cur = db.query(Currency).filter(Currency.id == trip.base_currency_id).first()

    return {"success": True, "message": "OK", "data": {
        "items": [
            {
                "id":             i.id,
                "title":          i.title,
                "amount":         float(i.amount),
                "currency_id":    i.currency_id,
                "amount_in_base": float(i.amount_in_base or 0),
                "category_id":    i.category_id,
                "is_paid":        bool(i.is_paid),
                "paid_by":        i.paid_by,
                "note":           i.note,
                "created_at":     str(i.created_at),
            }
            for i in items
        ],
        "total":           round(total, 2),
        "total_paid":      round(total_paid, 2),
        "by_category":     by_category,
        "base_currency": {
            "id":     base_cur.id,
            "code":   base_cur.code,
            "symbol": base_cur.symbol,
        } if base_cur else None,
        "budget_limit": float(trip.budget_limit) if trip.budget_limit else None,
    }}

@router.post("")
def create_budget_item(
    data:         BudgetItemCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(data.trip_id, current_user.id, ["owner", "editor"], db)

    if data.amount <= 0:
        raise HTTPException(400, "Сумма должна быть больше 0")

    amount_in_base = calc_amount_in_base(db, data.trip_id, data.amount, data.currency_id)

    item = BudgetItem(
        trip_id        = data.trip_id,
        added_by       = current_user.id,
        title          = data.title,
        amount         = data.amount,
        currency_id    = data.currency_id,
        amount_in_base = amount_in_base,
        category_id    = data.category_id,
        is_paid        = 1 if data.is_paid else 0,
        paid_by        = data.paid_by,
        paid_at        = datetime.utcnow() if data.is_paid else None,
        note           = data.note,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {"success": True, "message": "Расход добавлен", "data": {
        "id":             item.id,
        "title":          item.title,
        "amount":         float(item.amount),
        "amount_in_base": float(item.amount_in_base or 0),
        "is_paid":        bool(item.is_paid),
    }}

@router.put("/{item_id}")
def update_budget_item(
    item_id:      int,
    data:         BudgetItemUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Расход не найден")

    check_trip_access(item.trip_id, current_user.id, ["owner", "editor"], db)

    update_data = data.model_dump(exclude_none=True)

    if "is_paid" in update_data:
        item.is_paid = 1 if update_data.pop("is_paid") else 0
        item.paid_at = datetime.utcnow() if item.is_paid else None

    for field, value in update_data.items():
        setattr(item, field, value)

    if data.amount or data.currency_id:
        item.amount_in_base = calc_amount_in_base(
            db, item.trip_id,
            item.amount,
            item.currency_id,
        )

    db.commit()

    return {"success": True, "message": "Расход обновлён", "data": {"id": item.id}}

@router.delete("/{item_id}")
def delete_budget_item(
    item_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Расход не найден")

    check_trip_access(item.trip_id, current_user.id, ["owner", "editor"], db)

    db.delete(item)
    db.commit()

    return {"success": True, "message": "Расход удалён", "data": {}}