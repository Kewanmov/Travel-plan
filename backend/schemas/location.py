# backend/schemas/location.py
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date, time


class LocationCreate(BaseModel):
    trip_id:      int   = Field(ge=1)
    name:         str   = Field(min_length=1, max_length=200)
    address:      Optional[str] = Field(default=None, max_length=500)
    lat:          float = Field(ge=-90,  le=90)
    lng:          float = Field(ge=-180, le=180)
    place_id:     Optional[str] = Field(default=None, max_length=200)
    place_source: Optional[Literal["google", "osm", "manual", "2gis"]] = "manual"
    category_id:  Optional[int] = Field(default=None, ge=1)
    note:         Optional[str] = Field(default=None, max_length=2000)


class LocationUpdate(BaseModel):
    name:         Optional[str]   = Field(default=None, min_length=1, max_length=200)
    address:      Optional[str]   = Field(default=None, max_length=500)
    lat:          Optional[float] = Field(default=None, ge=-90,  le=90)
    lng:          Optional[float] = Field(default=None, ge=-180, le=180)
    category_id:  Optional[int]   = Field(default=None, ge=1)
    note:         Optional[str]   = Field(default=None, max_length=2000)


class ItineraryCreate(BaseModel):
    day_number:             int = Field(default=1, ge=1, le=365)
    visit_date:             Optional[date] = None
    visit_time:             Optional[time] = None
    duration_min:           Optional[int]  = Field(default=None, ge=0, le=10080)
    transport_to:           Optional[Literal[
                                "walk","car","taxi",
                                "bus","metro","train","boat","other"
                            ]] = None
    transport_duration_min: Optional[int]  = Field(default=None, ge=0, le=10080)
    note:                   Optional[str]  = Field(default=None, max_length=2000)


class ItineraryUpdate(BaseModel):
    day_number:             Optional[int]  = Field(default=None, ge=1, le=365)
    visit_date:             Optional[date] = None
    visit_time:             Optional[time] = None
    duration_min:           Optional[int]  = Field(default=None, ge=0, le=10080)
    order_index:            Optional[int]  = Field(default=None, ge=0)
    is_visited:             Optional[bool] = None
    transport_to:           Optional[Literal[
                                "walk","car","taxi",
                                "bus","metro","train","boat","other"
                            ]] = None
    transport_duration_min: Optional[int]  = Field(default=None, ge=0, le=10080)
    note:                   Optional[str]  = Field(default=None, max_length=2000)