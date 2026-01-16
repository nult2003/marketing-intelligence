import asyncio
from sqlalchemy import select
from app.core.async_database import AsyncSessionLocal
from app.models.models import MarketTrend

async def check_data():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(MarketTrend).order_by(MarketTrend.id.desc()).limit(20))
        trends = res.scalars().all()
        print(f"Checking last 20 trends:")
        for t in trends:
            print(f"ID: {t.id}, Name: {t.metric_name}, Value: {t.metric_value}, Unit: {t.metric_unit}, Company: {t.company_name}, Type: {t.metric_type}")

if __name__ == "__main__":
    asyncio.run(check_data())
