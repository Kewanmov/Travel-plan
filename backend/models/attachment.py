from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    trip_id        = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    location_id    = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True)
    budget_item_id = Column(Integer, ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=True)
    uploaded_by    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind           = Column(Enum("photo", "receipt", "document"), nullable=False, default="photo")
    filename       = Column(String(255), nullable=False)
    original_name  = Column(String(255), nullable=False)
    mime_type      = Column(String(100), nullable=False)
    size_bytes     = Column(Integer, nullable=False)
    created_at     = Column(TIMESTAMP, server_default=func.now())