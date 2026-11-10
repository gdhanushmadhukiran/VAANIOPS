from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import health, transcribe, orders, speak, stats, intelligence, conversations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vaaniops")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema on startup
    logger.info("Initializing VaaniOps database schema...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized.")
    yield


app = FastAPI(
    title="VaaniOps API",
    description="Voice Operating System for India's Small Businesses — Powered by Gnani AI Prisma & Timbre v2.5",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [origin.strip() for origin in settings.FRONTEND_ORIGIN.split(",") if origin.strip()]
# Include common dev hosts and wildcard fallback if specified
if "http://localhost:5173" not in origins:
    origins.append("http://localhost:5173")
if "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api prefix
app.include_router(health.router, prefix="/api")
app.include_router(transcribe.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(speak.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(intelligence.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")


@app.get("/")
def root():
    return {
        "project": "VaaniOps",
        "tagline": "Speak Naturally. Manage Intelligently.",
        "docs": "/docs",
        "health": "/api/health",
    }

