
import asyncio
from app.core.async_database import AsyncSessionLocal
from app.models.models import News, MarketTrend
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

async def debug_data():
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        print(f"Current UTC: {now}")
        print(f"Start of Today UTC: {start_of_today}")
        
        # Check News
        news_stmt = select(News).order_by(News.published_at.desc()).limit(5)
        news_res = await db.execute(news_stmt)
        news_items = news_res.scalars().all()
        
        print("\n--- Latest 5 News ---")
        for item in news_items:
            print(f"ID: {item.id}, Title: {item.title[:30]}, PublishedAt: {item.published_at}, Tag: {item.industry_tag}")
            
        # Check Trends
        trend_stmt = select(MarketTrend).order_by(MarketTrend.published_at.desc()).limit(5)
        trend_res = await db.execute(trend_stmt)
        trend_items = trend_res.scalars().all()
        
        print("\n--- Latest 5 Trends ---")
        for item in trend_items:
            print(f"ID: {item.id}, Name: {item.metric_name}, PublishedAt: {item.published_at}, Tag: {item.industry_tag}")

        # Count news for today
        count_stmt = select(func.count(News.id)).where(News.published_at >= start_of_today)
        count_res = await db.execute(count_stmt)
        print(f"\nNews published >= start_of_today: {count_res.scalar()}")

if __name__ == "__main__":
    asyncio.run(debug_data())
