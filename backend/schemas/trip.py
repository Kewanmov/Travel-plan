from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import date, datetime


class TripCreate(BaseModel):
    title:            str = Field(min_length=1, max_length=200)
    city:             str = Field(min_length=1, max_length=120)
    country:          Optional[str]   = Field(default=None, max_length=120)
    description:      Optional[str]   = Field(default=None, max_length=4000)
    date_start:       date
    date_end:         date
    base_currency_id: Optional[int]   = Field(default=1, ge=1)
    budget_limit:     Optional[float] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_dates(self):
        if self.date_end < self.date_start:
            raise ValueError("Дата окончания не может быть раньше даты начала")
        return self


class TripUpdate(BaseModel):
    title:            Optional[str]   = Field(default=None, min_length=1, max_length=200)
    city:             Optional[str]   = Field(default=None, min_length=1, max_length=120)
    country:          Optional[str]   = Field(default=None, max_length=120)
    description:      Optional[str]   = Field(default=None, max_length=4000)
    date_start:       Optional[date]  = None
    date_end:         Optional[date]  = None
    base_currency_id: Optional[int]   = Field(default=None, ge=1)
    budget_limit:     Optional[float] = Field(default=None, ge=0)
    status:           Optional[Literal["planned", "active", "completed", "archived"]] = None

    @model_validator(mode="after")
    def _check_dates(self):
        if self.date_start and self.date_end and self.date_end < self.date_start:
            raise ValueError("Дата окончания не может быть раньше даты начала")
        return self


class TripOut(BaseModel):
    id:               int
    title:            str
    city:             str
    country:          Optional[str]
    description:      Optional[str]
    date_start:       date
    date_end:         date
    cover_image:      Optional[str]
    base_currency_id: int
    budget_limit:     Optional[float]
    status:           str
    is_public:        Optional[bool] = False
    created_at:       datetime

    class Config:
        from_attributes = True


class TripVisibilityUpdate(BaseModel):
    is_public: bool