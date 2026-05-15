# backend/models/user.py
from sqlalchemy import Column, Integer, String, Text, Enum, TIMESTAMP, SmallInteger, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(100), nullable=False, unique=True)
    password      = Column(String(255), nullable=False)
    role          = Column(Enum("user", "admin"), nullable=False, default="user")
    avatar        = Column(String(255), nullable=True)
    bio           = Column(Text, nullable=True)
    phone         = Column(String(20), nullable=True)
    is_active     = Column(Integer, nullable=False, default=1)
    last_login_at = Column(TIMESTAMP, nullable=True)
    created_at    = Column(TIMESTAMP, server_default=func.now())
    updated_at    = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    trips       = relationship("Trip", back_populates="owner")
    memberships = relationship("TripMember", back_populates="user", foreign_keys="TripMember.user_id")
    settings    = relationship("UserSettings", back_populates="user", uselist=False)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id             = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    default_currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False, default=1)
    language            = Column(String(10), nullable=False, default="ru")
    timezone            = Column(String(50), nullable=False, default="Europe/Moscow")
    notify_invites      = Column(Integer, nullable=False, default=1)
    notify_updates      = Column(Integer, nullable=False, default=1)
    notify_reminders    = Column(Integer, nullable=False, default=1)
    reminder_days       = Column(SmallInteger, nullable=False, default=3)
    updated_at          = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="settings")