from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Invitation(Base):
    __tablename__ = "invitations"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    trip_id     = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    invited_by  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email       = Column(String(100), nullable=False)
    token       = Column(String(255), nullable=False, unique=True)
    role        = Column(Enum("editor", "viewer"), nullable=False, default="viewer")
    status      = Column(Enum("pending", "accepted", "declined"), nullable=False, default="pending")
    expires_at  = Column(TIMESTAMP, nullable=False)
    accepted_at = Column(TIMESTAMP, nullable=True)
    created_at  = Column(TIMESTAMP, server_default=func.now())

    trip    = relationship("Trip")
    inviter = relationship("User", foreign_keys=[invited_by])