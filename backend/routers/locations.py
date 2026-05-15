from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Location, TripItinerary, User
from schemas.location import LocationCreate, LocationUpdate, ItineraryCreate, ItineraryUpdate
from core.deps import get_current_user, check_trip_access
from datetime import datetime
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("")
def get_locations(
    trip_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(trip_id, current_user.id, ["owner", "editor", "viewer"], db)

    locations = (
        db.query(Location)
        .filter(Location.trip_id == trip_id)
        .order_by(Location.created_at)
        .all()
    )

    loc_ids = [loc.id for loc in locations]

    itineraries = (
        db.query(TripItinerary)
        .filter(TripItinerary.location_id.in_(loc_ids))
        .order_by(TripItinerary.day_number, TripItinerary.order_index)
        .all()
    ) if loc_ids else []

    itin_map = {}
    for itin in itineraries:
        itin_map.setdefault(itin.location_id, []).append({
            "id":                     itin.id,
            "day_number":             itin.day_number,
            "visit_date":             str(itin.visit_date) if itin.visit_date else None,
            "visit_time":             str(itin.visit_time) if itin.visit_time else None,
            "duration_min":           itin.duration_min,
            "order_index":            itin.order_index,
            "is_visited":             bool(itin.is_visited),
            "transport_to":           itin.transport_to,
            "transport_duration_min": itin.transport_duration_min,
            "note":                   itin.note,
        })

    return {
        "success": True,
        "message": "OK",
        "data": [
            {
                "id":           loc.id,
                "trip_id":      loc.trip_id,
                "name":         loc.name,
                "address":      loc.address,
                "lat":          float(loc.lat),
                "lng":          float(loc.lng),
                "place_id":     loc.place_id,
                "place_source": loc.place_source,
                "category_id":  loc.category_id,
                "note":         loc.note,
                "itinerary":    itin_map.get(loc.id, []),
            }
            for loc in locations
        ]
    }


@router.post("")
def create_location(
    data:         LocationCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(data.trip_id, current_user.id, ["owner", "editor"], db)

    location = Location(
        trip_id      = data.trip_id,
        added_by     = current_user.id,
        name         = data.name,
        address      = data.address,
        lat          = data.lat,
        lng          = data.lng,
        place_id     = data.place_id,
        place_source = data.place_source or "manual",
        category_id  = data.category_id,
        note         = data.note,
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    return {
        "success": True,
        "message": "Место добавлено",
        "data": {
            "id":   location.id,
            "name": location.name,
            "lat":  float(location.lat),
            "lng":  float(location.lng),
        }
    }


@router.put("/{location_id}")
def update_location(
    location_id:  int,
    data:         LocationUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(404, "Место не найдено")

    check_trip_access(location.trip_id, current_user.id, ["owner", "editor"], db)

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(location, field, value)

    db.commit()

    return {"success": True, "message": "Место обновлено", "data": {"id": location.id}}


@router.delete("/{location_id}")
def delete_location(
    location_id:  int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(404, "Место не найдено")

    check_trip_access(location.trip_id, current_user.id, ["owner", "editor"], db)

    db.delete(location)
    db.commit()

    return {"success": True, "message": "Место удалено", "data": {}}


class ReorderItem(BaseModel):
    location_id: int
    day_number:  int
    order_index: int


class ReorderPayload(BaseModel):
    trip_id: int
    items:   List[ReorderItem]


@router.patch("/itinerary/reorder")
def reorder_itinerary(
    payload:      ReorderPayload,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(payload.trip_id, current_user.id, ["owner", "editor"], db)

    if not payload.items:
        return {"success": True, "message": "OK", "data": {"updated": 0}}

    loc_ids = [i.location_id for i in payload.items]
    valid_ids = {
        lid for (lid,) in db.query(Location.id)
        .filter(Location.id.in_(loc_ids), Location.trip_id == payload.trip_id)
        .all()
    }

    existing = {
        it.location_id: it for it in db.query(TripItinerary)
        .filter(TripItinerary.trip_id == payload.trip_id,
                TripItinerary.location_id.in_(loc_ids))
        .all()
    }

    updated = 0
    for it in payload.items:
        if it.location_id not in valid_ids:
            continue
        row = existing.get(it.location_id)
        if row:
            row.day_number  = max(1, it.day_number)
            row.order_index = max(0, it.order_index)
        else:
            db.add(TripItinerary(
                trip_id     = payload.trip_id,
                location_id = it.location_id,
                day_number  = max(1, it.day_number),
                order_index = max(0, it.order_index),
            ))
        updated += 1

    db.commit()
    return {"success": True, "message": "Маршрут обновлён", "data": {"updated": updated}}


@router.post("/{location_id}/itinerary")
def add_to_itinerary(
    location_id:  int,
    data:         ItineraryCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(404, "Место не найдено")

    check_trip_access(location.trip_id, current_user.id, ["owner", "editor"], db)

    max_order = db.query(func.max(TripItinerary.order_index)).filter(
        TripItinerary.trip_id    == location.trip_id,
        TripItinerary.day_number == data.day_number,
    ).scalar() or 0

    itin = TripItinerary(
        trip_id                = location.trip_id,
        location_id            = location_id,
        day_number             = data.day_number,
        visit_date             = data.visit_date,
        visit_time             = data.visit_time,
        duration_min           = data.duration_min,
        order_index            = max_order + 1,
        transport_to           = data.transport_to,
        transport_duration_min = data.transport_duration_min,
        note                   = data.note,
    )
    db.add(itin)
    db.commit()
    db.refresh(itin)

    return {
        "success": True,
        "message": "Добавлено в маршрут",
        "data": {"id": itin.id, "day_number": itin.day_number}
    }


@router.put("/itinerary/{itin_id}")
def update_itinerary(
    itin_id:      int,
    data:         ItineraryUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    itin = db.query(TripItinerary).filter(TripItinerary.id == itin_id).first()
    if not itin:
        raise HTTPException(404, "Запись маршрута не найдена")

    check_trip_access(itin.trip_id, current_user.id, ["owner", "editor"], db)

    update_data = data.model_dump(exclude_none=True)

    if "is_visited" in update_data:
        itin.is_visited = 1 if update_data.pop("is_visited") else 0
        itin.visited_at = datetime.utcnow() if itin.is_visited else None

    for field, value in update_data.items():
        setattr(itin, field, value)

    db.commit()

    return {"success": True, "message": "Маршрут обновлён", "data": {"id": itin.id}}