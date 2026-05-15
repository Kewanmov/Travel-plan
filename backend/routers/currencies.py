from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Currency, User
from core.deps import get_current_user

router = APIRouter(prefix="/currencies", tags=["currencies"])

@router.get("")
def get_currencies(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    currencies = db.query(Currency).filter(Currency.is_active == 1).order_by(Currency.id).all()

    return {"success": True, "message": "OK", "data": [
        {
            "id":          c.id,
            "code":        c.code,
            "name":        c.name,
            "symbol":      c.symbol,
            "rate_to_rub": float(c.rate_to_rub),
        }
        for c in currencies
    ]}