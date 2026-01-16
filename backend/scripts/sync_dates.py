import asyncio
from sqlalchemy import update
from app.core.async_database import AsyncSessionLocal
from app.models.models import News, MarketTrend

async def sync_dates():
    async with AsyncSessionLocal() as db:
        print("Syncing published_at with created_at/timestamp for legacy data...")
        
        # Update News
        stmt_news = update(News).values(published_at=News.created_at)
        res_news = await db.execute(stmt_news)
        
        # Update MarketTrend
        stmt_trend = update(MarketTrend).values(published_at=MarketTrend.timestamp)
        res_trend = await db.execute(stmt_trend)
        
        await db.commit()
        print(f"Synced {res_news.rowcount} news items and {res_trend.rowcount} trend items.")

if __name__ == "__main__":
    asyncio.run(sync_dates())
