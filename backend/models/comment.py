# backend/models/comment.py
from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base


class TripComment(Base):
    __tablename__ = "trip_comments"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    trip_id    = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content    = Column(Text, nullable=False)
    is_edited  = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())