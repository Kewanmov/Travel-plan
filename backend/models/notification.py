from sqlalchemy import Column, Integer, String, Text, Enum, TIMESTAMP, JSON, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type       = Column(
        Enum(
            "trip_invite", "trip_update", "member_joined", "member_left",
            "task_assigned", "task_done", "budget_limit", "trip_reminder",
        ),
        nullable=False,
    )
    title      = Column(String(255), nullable=False)
    message    = Column(Text, nullable=True)
    data       = Column(JSON, nullable=True)
    is_read    = Column(Integer, nullable=False, default=0)
    expires_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())