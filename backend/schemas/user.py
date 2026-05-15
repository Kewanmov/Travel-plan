from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


def _check_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Пароль должен быть не короче 8 символов")
    if len(v) > 128:
        raise ValueError("Пароль слишком длинный (макс 128 символов)")
    if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("Пароль должен содержать хотя бы одну букву и одну цифру")
    return v


class UserRegister(BaseModel):
    name:     str = Field(min_length=2, max_length=100)
    email:    EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def _v_pwd(cls, v): return _check_password_strength(v)

    @field_validator("name")
    @classmethod
    def _v_name(cls, v): return v.strip()


class UserLogin(BaseModel):
    email:    EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id:            int
    username:      str
    name:          str
    email:         str
    role:          str
    avatar:        Optional[str]
    bio:           Optional[str]
    phone:         Optional[str]
    created_at:    datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name:         Optional[str] = Field(default=None, min_length=2, max_length=100)
    email:        Optional[EmailStr] = None
    bio:          Optional[str] = Field(default=None, max_length=1000)
    phone:        Optional[str] = Field(default=None, max_length=32)
    old_password: Optional[str] = Field(default=None, max_length=128)
    password:     Optional[str] = None

    @field_validator("password")
    @classmethod
    def _v_pwd(cls, v):
        if v is None:
            return v
        return _check_password_strength(v)


class AccountDelete(BaseModel):
    password: str = Field(min_length=1, max_length=128)