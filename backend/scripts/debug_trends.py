
import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from app.core.async_database import AsyncSessionLocal
from app.models.models import News, MarketTrend
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

async def debug_data():
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        start_of_today_utc = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Start of Jan 16 (Local VN) is Jan 15 17:00 UTC
        vn_today_utc = datetime(2026, 1, 15, 17, 0, 0, tzinfo=timezone.utc)

        print(f"Current UTC: {now}")
        print(f"VN Today Start (UTC): {vn_today_utc}")
        
        # Check Trends
        print("\n--- Latest 10 Trends ---")
        trend_stmt = select(MarketTrend).order_by(MarketTrend.published_at.desc()).limit(10)
        trend_res = await db.execute(trend_stmt)
        trend_items = trend_res.scalars().all()
        
        for item in trend_items:
            print(f"ID: {item.id}, Name: {item.metric_name}, PubAt: {item.published_at}, Industry: {item.industry_tag}")

        # Count trends for 'Daily' window (last 24h)
        rolling_24h = now - timedelta(days=1)
        count_stmt = select(func.count(MarketTrend.id)).where(MarketTrend.published_at >= rolling_24h)
        count_res = await db.execute(count_stmt)
        print(f"\nTrends with published_at >= {rolling_24h}: {count_res.scalar()}")

if __name__ == "__main__":
    asyncio.run(debug_data())
