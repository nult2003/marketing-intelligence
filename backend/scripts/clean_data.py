import asyncio
from sqlalchemy import select, delete
from app.core.async_database import AsyncSessionLocal
from app.models.models import MarketTrend

async def clean_unreasonable_data():
    async with AsyncSessionLocal() as db:
        print("Starting data cleaning...")
        
        # 1. Delete zero values
        stmt_zero = delete(MarketTrend).where(MarketTrend.metric_value == 0)
        result = await db.execute(stmt_zero)
        print(f"Removed {result.rowcount} records with value 0.")
        
        # 2. Check for extreme outliers (optional, here we just filter 0)
        # You could add more complex logic here if needed
        
        await db.commit()
        print("Cleaning complete.")

if __name__ == "__main__":
    asyncio.run(clean_unreasonable_data())
