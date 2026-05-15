# backend/routers/public.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Trip, Location, TripItinerary, User
from core.ratelimit import rate_limit

router = APIRouter(prefix="/public", tags=["public"])

_public_limit = rate_limit("public_trip", limit=60, window_sec=60)  # 60 req/min на IP


@router.get("/trips/{trip_id}", dependencies=[Depends(_public_limit)])
def get_public_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip or not trip.is_public:
        raise HTTPException(404, "Поездка не найдена или не является публичной")

    owner = db.query(User).filter(User.id == trip.user_id).first()

    locations = db.query(Location).filter(Location.trip_id == trip_id).all()
    itin_rows = (
        db.query(TripItinerary)
        .filter(TripItinerary.trip_id == trip_id)
        .order_by(TripItinerary.day_number, TripItinerary.order_index)
        .all()
    )
    itin_by_loc = {it.location_id: it for it in itin_rows}

    locations_out = []
    for loc in locations:
        it = itin_by_loc.get(loc.id)
        locations_out.append({
            "id":         loc.id,
            "name":       loc.name,
            "address":    loc.address,
            "lat":        float(loc.lat),
            "lng":        float(loc.lng),
            "note":       loc.note,
            "day_number": it.day_number if it else None,
            "visit_time": str(it.visit_time) if it and it.visit_time else None,
            "order_index": it.order_index if it else 0,
        })

    locations_out.sort(key=lambda x: (x["day_number"] or 999, x["order_index"]))

    return {
        "success": True,
        "message": "OK",
        "data": {
            "id":           trip.id,
            "title":        trip.title,
            "city":         trip.city,
            "country":      trip.country,
            "description":  trip.description,
            "date_start":   str(trip.date_start),
            "date_end":     str(trip.date_end),
            "cover_image":  trip.cover_image,
            "status":       trip.status,
            "owner_name":   owner.name if owner else "—",
            "locations":    locations_out,
        }
    }