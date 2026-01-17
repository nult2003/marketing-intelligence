from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timedelta, timezone
from typing import List
from sqlalchemy.orm.attributes import flag_modified
from ..core.async_database import get_async_db
from ..models.models import News, AdminConfig, User, MarketTrend
from ..schemas import schemas
from ..tasks.worker import crawl_intelligence_task

router = APIRouter()

@router.get("/news", response_model=List[schemas.News])
async def get_news(
    industry: str = "All",
    db: AsyncSession = Depends(get_async_db)
):
    """Retrieve processed news items"""
    stmt = select(News).order_by(desc(News.created_at)).limit(50)
    if industry != "All":
        stmt = stmt.where(News.industry_tag == industry)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/admin/config", response_model=schemas.AdminConfig)
async def get_admin_config(db: AsyncSession = Depends(get_async_db)):
    """Fetch current crawler configuration"""
    stmt = select(AdminConfig).order_by(desc(AdminConfig.id))
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        # Create default config if none exists
        config = AdminConfig(search_keywords=["Electric Vehicle", "Lithium market"])
        db.add(config)
        await db.commit()
        await db.refresh(config)
    
    # Get keywords that have news associated with them
    news_stmt = select(News.industry_tag).distinct()
    news_result = await db.execute(news_stmt)
    keywords_with_data = [k for k in news_result.scalars().all() if k]
    
    # Return as a dict or set attribute on the model object (though it's not in the DB model)
    # The safest way is to return a dict that matches the schema
    return {
        "id": config.id,
        "search_keywords": config.search_keywords,
        "scraping_interval_minutes": config.scraping_interval_minutes,
        "last_run_at": config.last_run_at,
        "keywords_with_data": keywords_with_data
    }

@router.get("/admin/analytics")
async def get_analytics(
    industry: str = "All", 
    time_range: str = "Monthly",
    tz_offset: int = 420, # Default to 420 (UTC+7) if not provided
    db: AsyncSession = Depends(get_async_db)
):
    """Get aggregated sentiment, impact, and real market trends filtered by time range"""
    
    # Get current UTC time
    now = datetime.now(timezone.utc)
    
    # Calculate local start date based on tz_offset (in minutes)
    user_offset = timedelta(minutes=tz_offset)
    local_now = now + user_offset
    
    if time_range == "Daily":
        # Start of today in user's local time (00:00:00)
        local_start_of_today = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        # Convert back to UTC for DB query
        start_date = local_start_of_today - user_offset
    elif time_range == "Weekly":
        # Start of current week in user's local time (Monday 00:00:00)
        days_since_monday = local_now.weekday()
        local_start_of_week = (local_now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = local_start_of_week - user_offset
    elif time_range == "Monthly":
        # Last 30 days
        start_date = now - timedelta(days=30)
    elif time_range == "Yearly":
        # Last 365 days
        start_date = now - timedelta(days=365)
    else:
        # Default fallback
        start_date = now - timedelta(days=30)

    print(f"ANALYTICS: range={time_range}, industry={industry}, start_date_utc={start_date}")

    # 1. Fetch News for Sentiment/Impact
    news_stmt = select(News).where(News.published_at >= start_date).order_by(desc(News.published_at))
    if industry != "All":
        news_stmt = news_stmt.where(News.industry_tag == industry)
    
    news_result = await db.execute(news_stmt)
    news_items = news_result.scalars().all()

    # 2. Fetch Trends for Price Evolution
    trend_stmt = select(MarketTrend).where(MarketTrend.published_at >= start_date).order_by(desc(MarketTrend.published_at))
    if industry != "All":
        trend_stmt = trend_stmt.where(MarketTrend.industry_tag == industry)
    
    trend_result = await db.execute(trend_stmt)
    trend_items = trend_result.scalars().all()
    
    print(f"ANALYTICS RESULT: news_count={len(news_items)}, trends_count={len(trend_items)}")
    
    return {
        "news": news_items,
        "trends": trend_items
    }

@router.post("/admin/config", response_model=schemas.AdminConfig)
async def update_admin_config(
    config_in: schemas.AdminConfigUpdate,
    db: AsyncSession = Depends(get_async_db)
):
    """Update crawler keywords and interval"""
    # Simply add a new record for history/simplicity or update existing
    # Here we'll update the latest one
    stmt = select(AdminConfig).order_by(desc(AdminConfig.id))
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        config = AdminConfig(
            search_keywords=config_in.search_keywords,
            scraping_interval_minutes=config_in.scraping_interval_minutes
        )
        db.add(config)
    else:
        config.search_keywords = config_in.search_keywords
        config.scraping_interval_minutes = config_in.scraping_interval_minutes
        # Explicitly flag JSON column as modified
        flag_modified(config, "search_keywords")
    
    try:
        await db.commit()
        await db.refresh(config)
    except Exception as e:
        await db.rollback()
        print(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail="Failed to update configuration")
        
    return config

@router.post("/admin/trigger-crawl")
async def trigger_crawl():
    """Manually trigger the market intelligence crawler"""
    crawl_intelligence_task.delay(force=True)
    return {"status": "Crawl task queued"}

@router.get("/admin/users", response_model=List[schemas.User])
async def get_users(db: AsyncSession = Depends(get_async_db)):
    """List all enrolled users"""
    stmt = select(User).order_by(User.id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/admin/users", response_model=schemas.User)
async def enroll_user(user_in: schemas.UserEnroll, db: AsyncSession = Depends(get_async_db)):
    """Enroll a new user/recipient for alerts"""
    # Check if exists
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already enrolled")
    
    new_user = User(
        email=user_in.email,
        industry_preference=user_in.industry_preference,
        receive_email_alerts=user_in.receive_email_alerts,
        hashed_password="[ENROLLED_NO_LOGIN]", # Dummy password for enrolled recipients
        is_admin=False
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.patch("/admin/users/{user_id}/toggle-alerts", response_model=schemas.User)
async def toggle_user_alerts(user_id: int, db: AsyncSession = Depends(get_async_db)):
    """Toggle alert status for a user"""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.receive_email_alerts = not user.receive_email_alerts
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_async_db)):
    """Remove a user/recipient"""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.delete(user)
    await db.commit()
    return {"status": "User deleted"}
