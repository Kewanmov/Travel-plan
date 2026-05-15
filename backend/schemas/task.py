# backend/schemas/task.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class TaskCreate(BaseModel):
    trip_id:     int = Field(ge=1)
    title:       str = Field(min_length=1, max_length=200)
    description: Optional[str]  = Field(default=None, max_length=2000)
    category_id: Optional[int]  = Field(default=None, ge=1)
    due_date:    Optional[date] = None


class TaskUpdate(BaseModel):
    title:       Optional[str]  = Field(default=None, min_length=1, max_length=200)
    description: Optional[str]  = Field(default=None, max_length=2000)
    category_id: Optional[int]  = Field(default=None, ge=1)
    due_date:    Optional[date] = None
    is_done:     Optional[bool] = None
    order_index: Optional[int]  = Field(default=None, ge=0)


class TaskOut(BaseModel):
    id:          int
    trip_id:     int
    title:       str
    description: Optional[str]
    category_id: Optional[int]
    is_done:     bool
    due_date:    Optional[date]
    order_index: int
    done_by:     Optional[int]
    done_at:     Optional[datetime]
    created_at:  datetime

    class Config:
        from_attributes = True