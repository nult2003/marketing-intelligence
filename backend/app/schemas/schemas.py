from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    industry_preference: Optional[str] = None
    receive_email_alerts: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class User(UserBase):
    id: int
    is_admin: bool

    class Config:
        from_attributes = True

class UserEnroll(BaseModel):
    email: EmailStr
    industry_preference: str = "Electric Vehicle"
    receive_email_alerts: bool = True

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# News schemas
class NewsBase(BaseModel):
    title: str
    url: str
    source_domain: Optional[str] = None
    summary: Optional[str] = None
    sentiment_score: float = 0.0
    impact_score: float = 0.0
    urgency: Optional[str] = None
    risk_type: Optional[str] = None
    action_recommendation: Optional[str] = None
    industry_tag: Optional[str] = None
    published_at: Optional[datetime] = None

class NewsCreate(NewsBase):
    content_hash: str

class News(NewsBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# AdminConfig schemas
class AdminConfigBase(BaseModel):
    search_keywords: List[str] = []
    scraping_interval_minutes: int = 60

class AdminConfigUpdate(AdminConfigBase):
    pass

class AdminConfig(AdminConfigBase):
    id: int
    last_run_at: Optional[datetime] = None
    keywords_with_data: List[str] = []

    class Config:
        from_attributes = True
