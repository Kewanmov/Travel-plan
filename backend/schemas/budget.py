from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BudgetItemCreate(BaseModel):
    trip_id:     int   = Field(ge=1)
    title:       str   = Field(min_length=1, max_length=200)
    amount:      float = Field(gt=0, le=1_000_000_000)
    currency_id: int   = Field(ge=1)
    category_id: Optional[int]  = Field(default=None, ge=1)
    is_paid:     Optional[bool] = False
    paid_by:     Optional[int]  = Field(default=None, ge=1)
    note:        Optional[str]  = Field(default=None, max_length=2000)
    location_id: Optional[int]  = Field(default=None, ge=1)


class BudgetItemUpdate(BaseModel):
    title:       Optional[str]   = Field(default=None, min_length=1, max_length=200)
    amount:      Optional[float] = Field(default=None, gt=0, le=1_000_000_000)
    currency_id: Optional[int]   = Field(default=None, ge=1)
    category_id: Optional[int]   = Field(default=None, ge=1)
    is_paid:     Optional[bool]  = None
    paid_by:     Optional[int]   = Field(default=None, ge=1)
    note:        Optional[str]   = Field(default=None, max_length=2000)


class BudgetItemOut(BaseModel):
    id:             int
    trip_id:        int
    title:          str
    amount:         float
    currency_id:    int
    amount_in_base: Optional[float]
    category_id:    Optional[int]
    is_paid:        bool
    paid_by:        Optional[int]
    note:           Optional[str]
    created_at:     datetime

    class Config:
        from_attributes = True