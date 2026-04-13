import logging
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.core.database import engine, Base
from app.api.auth import router as auth_router
from app.api.main_api import router as main_router

settings = get_settings()

# Configurar Sentry
if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crear tablas si no existen (en prod usar Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    if settings.AWS_ACCESS_KEY_ID == "test":
        import os
        os.makedirs("uploads", exist_ok=True)
        
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="contabilizAR API",
    description="SaaS de automatización contable para Argentina. OCR + IA para Holistor, Tango Gestión y Bejerman.",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(main_router, prefix="/api/v1")

if settings.AWS_ACCESS_KEY_ID == "test":
    from fastapi.staticfiles import StaticFiles
    import os
    os.makedirs("uploads", exist_ok=True)
    app.mount("/api/v1/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
