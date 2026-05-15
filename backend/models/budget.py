# backend/models/budget.py
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Currency(Base):
    __tablename__ = "currencies"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    code        = Column(String(10), nullable=False, unique=True)
    name        = Column(String(100), nullable=False)
    symbol      = Column(String(10), nullable=False)
    rate_to_rub = Column(DECIMAL(10, 4), nullable=False, default=1.0)
    is_active   = Column(Integer, nullable=False, default=1)
    updated_at  = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    rates_history = relationship("CurrencyRateHistory", back_populates="currency")


class CurrencyRateHistory(Base):
    __tablename__ = "currency_rates_history"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    currency_id = Column(Integer, ForeignKey("currencies.id", ondelete="CASCADE"), nullable=False)
    rate_to_rub = Column(DECIMAL(10, 4), nullable=False)
    source      = Column(String(50), nullable=True, default="api")
    recorded_at = Column(TIMESTAMP, server_default=func.now())

    currency = relationship("Currency", back_populates="rates_history")


class BudgetCategory(Base):
    __tablename__ = "budget_categories"

    id    = Column(Integer, primary_key=True, autoincrement=True)
    slug  = Column(String(50), nullable=False, unique=True)
    name  = Column(String(100), nullable=False)
    icon  = Column(String(50), nullable=True)
    color = Column(String(20), nullable=True)


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    trip_id        = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    added_by       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id    = Column(Integer, ForeignKey("budget_categories.id"), nullable=True)
    title          = Column(String(255), nullable=False)
    amount         = Column(DECIMAL(10, 2), nullable=False)
    currency_id    = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    amount_in_base = Column(DECIMAL(10, 2), nullable=True)
    is_paid        = Column(Integer, nullable=False, default=0)
    paid_by        = Column(Integer, ForeignKey("users.id"), nullable=True)
    paid_at        = Column(TIMESTAMP, nullable=True)
    location_id    = Column(Integer, ForeignKey("locations.id"), nullable=True)
    itinerary_id   = Column(Integer, ForeignKey("trip_itinerary.id"), nullable=True)
    receipt_image  = Column(String(255), nullable=True)
    note           = Column(Text, nullable=True)
    created_at     = Column(TIMESTAMP, server_default=func.now())
    updated_at     = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    trip     = relationship("Trip", back_populates="budget_items")
    currency = relationship("Currency", foreign_keys=[currency_id])
    category = relationship("BudgetCategory")