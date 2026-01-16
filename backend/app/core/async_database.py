from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

# Use NullPool because worker tasks run in separate event loops (asyncio.run)
# and asyncpg connections cannot be shared across different loops.
async_engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    poolclass=NullPool
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_async_db():
    async with AsyncSessionLocal() as session:
        yield session
