# backend/routers/places.py
from fastapi import APIRouter, Depends, Query, HTTPException
from core.deps import get_current_user
from core.config import DGIS_API_KEY, DGIS_BASE_URL
from models import User
import httpx

router = APIRouter(prefix="/places", tags=["places"])

@router.get("/search")
async def search_places(
    q:            str   = Query(..., description="Поисковый запрос"),
    lat:          float = Query(None, description="Широта центра поиска"),
    lng:          float = Query(None, description="Долгота центра поиска"),
    radius:       int   = Query(1000, description="Радиус поиска в метрах"),
    limit:        int   = Query(10),
    current_user: User  = Depends(get_current_user),
):
    params = {
        "q":      q,
        "key":    DGIS_API_KEY,
        "fields": "items.point,items.address,items.rubrics,items.contact_groups,items.description,items.photos",
        "page_size": limit,
        "locale": "ru_RU",
    }

    if lat and lng:
        params["location"] = f"{lng},{lat}"
        params["radius"]   = radius
        params["sort"]     = "distance"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{DGIS_BASE_URL}/items",
                params  = params,
                timeout = 10.0,
            )
            resp.raise_for_status()
            raw = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Ошибка 2GIS API: {str(e)}")

    items = raw.get("result", {}).get("items", [])

    places = []
    for item in items:
        point = item.get("point", {})
        places.append({
            "place_id": item.get("id", ""),
            "name":     item.get("name", ""),
            "address":  item.get("address_name", ""),
            "lat":      point.get("lat"),
            "lng":      point.get("lon"),
            "category": item.get("rubrics", [{}])[0].get("name", "") if item.get("rubrics") else "",
            "photos":   [p.get("url_template", "").replace("{width}x{height}", "400x300") for p in item.get("photos", [])[:3]],
        })

    return {"success": True, "message": "OK", "data": places}


@router.get("/nearby")
async def get_nearby(
    lat:          float = Query(...),
    lng:          float = Query(...),
    category:     str   = Query(None, description="restaurant,hotel,museum,park,beach"),
    radius:       int   = Query(2000),
    limit:        int   = Query(20),
    current_user: User  = Depends(get_current_user),
):
    category_map = {
        "restaurant": "Кафе и рестораны",
        "hotel":      "Гостиницы",
        "museum":     "Музеи",
        "park":       "Парки",
        "beach":      "Пляжи",
        "shopping":   "Торговые центры",
        "bar":        "Бары и клубы",
        "attraction": "Достопримечательности",
    }

    query = category_map.get(category, "") if category else ""

    params = {
        "location": f"{lng},{lat}",
        "radius":   radius,
        "key":      DGIS_API_KEY,
        "fields":   "items.point,items.address,items.rubrics,items.rating,items.photos",
        "page_size": limit,
        "locale":   "ru_RU",
        "sort":     "distance",
    }

    if query:
        params["q"] = query

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{DGIS_BASE_URL}/items",
                params  = params,
                timeout = 10.0,
            )
            resp.raise_for_status()
            raw = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Ошибка 2GIS API: {str(e)}")

    items = raw.get("result", {}).get("items", [])

    places = []
    for item in items:
        point = item.get("point", {})
        places.append({
            "place_id": item.get("id", ""),
            "name":     item.get("name", ""),
            "address":  item.get("address_name", ""),
            "lat":      point.get("lat"),
            "lng":      point.get("lon"),
            "category": item.get("rubrics", [{}])[0].get("name", "") if item.get("rubrics") else "",
            "rating":   item.get("reviews", {}).get("rating"),
            "photos":   [p.get("url_template", "").replace("{width}x{height}", "400x300") for p in item.get("photos", [])[:2]],
        })

    return {"success": True, "message": "OK", "data": places}


@router.get("/detail/{place_id}")
async def get_place_detail(
    place_id:     str,
    current_user: User = Depends(get_current_user),
):
    params = {
        "id":     place_id,
        "key":    DGIS_API_KEY,
        "fields": "items.point,items.address,items.rubrics,items.contact_groups,items.schedule,items.description,items.photos,items.rating",
        "locale": "ru_RU",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{DGIS_BASE_URL}/items/byid",
                params  = params,
                timeout = 10.0,
            )
            resp.raise_for_status()
            raw = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Ошибка 2GIS API: {str(e)}")

    items = raw.get("result", {}).get("items", [])
    if not items:
        raise HTTPException(404, "Место не найдено")

    item  = items[0]
    point = item.get("point", {})

    contacts = {}
    for group in item.get("contact_groups", []):
        for contact in group.get("contacts", []):
            ctype = contact.get("type", "")
            if ctype == "phone":
                contacts["phone"] = contact.get("value", "")
            if ctype == "website":
                contacts["website"] = contact.get("value", "")

    return {"success": True, "message": "OK", "data": {
        "place_id":    item.get("id", ""),
        "name":        item.get("name", ""),
        "address":     item.get("address_name", ""),
        "lat":         point.get("lat"),
        "lng":         point.get("lon"),
        "category":    item.get("rubrics", [{}])[0].get("name", "") if item.get("rubrics") else "",
        "description": item.get("description", ""),
        "rating":      item.get("reviews", {}).get("rating"),
        "photos":      [p.get("url_template", "").replace("{width}x{height}", "800x600") for p in item.get("photos", [])[:10]],
        "contacts":    contacts,
        "schedule":    item.get("schedule", {}),
    }}


@router.get("/geocode")
async def geocode(
    q:            str  = Query(..., description="Адрес или название города"),
    current_user: User = Depends(get_current_user),
):
    params = {
        "q":      q,
        "key":    DGIS_API_KEY,
        "locale": "ru_RU",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://catalog.api.2gis.com/3.0/suggests",
                params  = params,
                timeout = 10.0,
            )
            resp.raise_for_status()
            raw = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Ошибка 2GIS API: {str(e)}")

    items = raw.get("result", {}).get("items", [])

    suggestions = []
    for item in items:
        point = item.get("point", {})
        suggestions.append({
            "place_id": item.get("id", ""),
            "name":     item.get("name", ""),
            "full_name": item.get("full_name", item.get("name", "")),
            "lat":      point.get("lat"),
            "lng":      point.get("lon"),
            "type":     item.get("type", ""),
        })

    return {"success": True, "message": "OK", "data": suggestions}