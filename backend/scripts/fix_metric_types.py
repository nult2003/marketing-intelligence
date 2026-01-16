import asyncio
from sqlalchemy import select, update
from app.core.async_database import AsyncSessionLocal
from app.models.models import MarketTrend

async def fix_and_verify_types():
    async with AsyncSessionLocal() as db:
        print("Checking data types in market_trends...")
        stmt = select(MarketTrend)
        result = await db.execute(stmt)
        trends = result.scalars().all()
        
        fixed_count = 0
        for t in trends:
            # Check if it should be a ratio
            should_be_ratio = False
            if t.metric_unit and any(x in t.metric_unit.lower() for x in ['%', 'percent']):
                should_be_ratio = True
            if not should_be_ratio and any(x in t.metric_name.lower() for x in ['share', 'percentage', 'ratio']):
                should_be_ratio = True
                
            if should_be_ratio and t.metric_type != 'ratio':
                t.metric_type = 'ratio'
                fixed_count += 1
            elif not should_be_ratio and t.metric_type != 'absolute':
                t.metric_type = 'absolute'
                fixed_count += 1
        
        if fixed_count > 0:
            await db.commit()
            print(f"Fixed {fixed_count} records.")
        else:
            print("No records needed fixing.")
            
        # Verify
        print("\nCurrent data distribution:")
        res_abs = await db.execute(select(MarketTrend).where(MarketTrend.metric_type == 'absolute'))
        res_ratio = await db.execute(select(MarketTrend).where(MarketTrend.metric_type == 'ratio'))
        print(f"Absolute records: {len(res_abs.scalars().all())}")
        print(f"Ratio records: {len(res_ratio.scalars().all())}")

if __name__ == "__main__":
    asyncio.run(fix_and_verify_types())
