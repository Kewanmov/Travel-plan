# backend/models/location.py
from sqlalchemy import Column, Integer, String, Text, Date, Time, TIMESTAMP, DECIMAL, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class LocationCategory(Base):
    __tablename__ = "location_categories"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    slug        = Column(String(50), nullable=False, unique=True)
    name        = Column(String(100), nullable=False)
    icon        = Column(String(50), nullable=True)
    color       = Column(String(20), nullable=True)
    google_type = Column(String(100), nullable=True)


class Location(Base):
    __tablename__ = "locations"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    trip_id      = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    added_by     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(255), nullable=False)
    address      = Column(String(500), nullable=True)
    lat          = Column(DECIMAL(10, 8), nullable=False)
    lng          = Column(DECIMAL(11, 8), nullable=False)
    place_id     = Column(String(255), nullable=True)
    place_source = Column(Enum("google", "osm", "manual"), nullable=True, default="manual")
    category_id  = Column(Integer, ForeignKey("location_categories.id"), nullable=True)
    note         = Column(Text, nullable=True)
    created_at   = Column(TIMESTAMP, server_default=func.now())
    updated_at   = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    trip      = relationship("Trip", back_populates="locations")
    category  = relationship("LocationCategory")
    author    = relationship("User", foreign_keys=[added_by])
    itinerary = relationship("TripItinerary", back_populates="location")


class TripItinerary(Base):
    __tablename__ = "trip_itinerary"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    trip_id                = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    location_id            = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    day_number             = Column(Integer, nullable=False, default=1)
    visit_date             = Column(Date, nullable=True)
    visit_time             = Column(Time, nullable=True)
    duration_min           = Column(Integer, nullable=True)
    order_index            = Column(Integer, nullable=False, default=0)
    is_visited             = Column(Integer, nullable=False, default=0)
    visited_at             = Column(TIMESTAMP, nullable=True)
    transport_to           = Column(
                                Enum("walk","car","taxi","bus","metro","train","boat","other"),
                                nullable=True
                             )
    transport_duration_min = Column(Integer, nullable=True)
    note                   = Column(Text, nullable=True)
    created_at             = Column(TIMESTAMP, server_default=func.now())
    updated_at             = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    trip     = relationship("Trip")
    location = relationship("Location", back_populates="itinerary")