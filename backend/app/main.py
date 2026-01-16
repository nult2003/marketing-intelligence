from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings

from .api.endpoints import router as api_router
from .api.auth import router as auth_router

from .core.database import engine, Base
from .models import models # Ensure models are registered

from alembic.config import Config
from alembic import command

app = FastAPI(title=settings.PROJECT_NAME)

@app.on_event("startup")
def startup_event():
    # Run migrations automatically on startup
    print("Running database migrations...")
    try:
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("Migrations applied successfully!")
    except Exception as e:
        print(f"Error running migrations: {e}")
        # Fallback to create_all if migrations fail (optional)
        Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_check():
    print("------------------------------------------------")
    print("CORS CONFIGURATION RELOADED: Localhost Allowed")
    print("------------------------------------------------")

app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(api_router, prefix="/api", tags=["endpoints"])

@app.get("/")
async def root():
    return {"message": "Welcome to Marketing Intelligent API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
