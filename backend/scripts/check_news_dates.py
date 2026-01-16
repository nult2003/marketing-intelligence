
import asyncio
from app.core.async_database import AsyncSessionLocal
from app.models.models import News
from sqlalchemy import select, func
from datetime import datetime, timezone

async def check_news_dates():
    async with AsyncSessionLocal() as db:
        stmt = select(func.max(News.published_at))
        result = await db.execute(stmt)
        latest_date = result.scalar()
        
        stmt_count = select(func.count(News.id))
        count = await db.execute(stmt_count)
        total = count.scalar()
        
        print(f"Total news items: {total}")
        print(f"Latest news date: {latest_date}")
        print(f"Current UTC time: {datetime.now(timezone.utc)}")

if __name__ == "__main__":
    asyncio.run(check_news_dates())
