# backend/models/trip.py
from sqlalchemy import Column, Integer, String, Text, Date, Enum, TIMESTAMP, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Trip(Base):
    __tablename__ = "trips"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    user_id            = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title              = Column(String(255), nullable=False)
    description        = Column(Text, nullable=True)
    city               = Column(String(255), nullable=False)
    country            = Column(String(100), nullable=True)
    country_code       = Column(String(5), nullable=True)
    timezone           = Column(String(50), nullable=True)
    date_start         = Column(Date, nullable=False)
    date_end           = Column(Date, nullable=False)
    cover_image        = Column(String(255), nullable=True)
    cover_image_source = Column(Enum("upload", "api", "url"), nullable=True, default="upload")
    base_currency_id   = Column(Integer, ForeignKey("currencies.id"), nullable=False, default=1)
    budget_limit       = Column(DECIMAL(10, 2), nullable=True)
    status             = Column(Enum("draft", "active", "completed", "archived"), default="active")
    is_public          = Column(Integer, nullable=False, default=0)
    created_at         = Column(TIMESTAMP, server_default=func.now())
    updated_at         = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    owner        = relationship("User", back_populates="trips")
    members      = relationship("TripMember", back_populates="trip")
    locations    = relationship("Location", back_populates="trip")
    budget_items = relationship("BudgetItem", back_populates="trip")
    tasks        = relationship("Task", back_populates="trip")
    tags         = relationship("TripTag", back_populates="trip")
    currency     = relationship("Currency", foreign_keys=[base_currency_id])


class TripMember(Base):
    __tablename__ = "trip_members"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    trip_id    = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role       = Column(Enum("owner", "editor", "viewer"), nullable=False, default="viewer")
    status     = Column(Enum("pending", "accepted", "declined"), nullable=False, default="pending")
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at  = Column(TIMESTAMP, server_default=func.now())

    trip = relationship("Trip", back_populates="members")
    user = relationship("User", back_populates="memberships", foreign_keys=[user_id])


class TripTag(Base):
    __tablename__ = "trip_tags"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    tag     = Column(String(50), nullable=False)

    trip = relationship("Trip", back_populates="tags")


