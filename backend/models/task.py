from sqlalchemy import Column, Integer, String, Text, Date, Enum, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class TaskCategory(Base):
    __tablename__ = "task_categories"

    id    = Column(Integer, primary_key=True, autoincrement=True)
    slug  = Column(String(50), nullable=False, unique=True)
    name  = Column(String(100), nullable=False)
    color = Column(String(20), nullable=True)


class Task(Base):
    __tablename__ = "tasks"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    trip_id     = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    added_by    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("task_categories.id"), nullable=True)
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority    = Column(Enum("low", "medium", "high"), nullable=False, default="medium")
    is_done     = Column(Integer, nullable=False, default=0)
    done_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    done_at     = Column(TIMESTAMP, nullable=True)
    due_date    = Column(Date, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    created_at  = Column(TIMESTAMP, server_default=func.now())
    updated_at  = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    trip     = relationship("Trip", back_populates="tasks")
    category = relationship("TaskCategory")