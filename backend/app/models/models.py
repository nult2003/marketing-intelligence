from datetime import datetime, timezone
from typing import Any
from sqlalchemy import String, Boolean, Float, DateTime, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    industry_preference: Mapped[str | None] = mapped_column(String(255))
    receive_email_alerts: Mapped[bool] = mapped_column(Boolean, default=True)

class News(Base):
    __tablename__ = "news"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), unique=True, index=True, nullable=False)
    source_domain: Mapped[str | None] = mapped_column(String(255)) # Added source_domain
    summary: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0) # 0-10
    impact_score: Mapped[float] = mapped_column(Float, default=0.0)    # 0-10
    urgency: Mapped[str] = mapped_column(String(20), default="Low") # High, Medium, Low
    risk_type: Mapped[str] = mapped_column(String(50), default="None")
    action_recommendation: Mapped[str | None] = mapped_column(Text)
    price_value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(50))
    industry_tag: Mapped[str | None] = mapped_column(String(100), index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class AdminConfig(Base):
    __tablename__ = "admin_configs"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    search_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    scraping_interval_minutes: Mapped[int] = mapped_column(default=60)

class SearchCache(Base):
    __tablename__ = "search_cache"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    keyword: Mapped[str] = mapped_column(String(255), index=True)
    urls: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class MarketTrend(Base):
    __tablename__ = "market_trends"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    news_id: Mapped[int | None] = mapped_column(index=True)
    metric_name: Mapped[str] = mapped_column(String(100), index=True)
    company_name: Mapped[str | None] = mapped_column(String(100), index=True)
    metric_value: Mapped[float] = mapped_column(Float)
    metric_unit: Mapped[str | None] = mapped_column(String(50))
    metric_type: Mapped[str] = mapped_column(String(20), default="absolute") # absolute or ratio
    industry_tag: Mapped[str | None] = mapped_column(String(100), index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
