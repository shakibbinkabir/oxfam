from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.geo import router as geo_router
from app.api.indicators import router as indicators_router
from app.api.units import router as units_router
from app.api.sources import router as sources_router
from app.api.scores import router as scores_router
from app.scripts.seed_superadmin import seed_superadmin


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_superadmin()
    yield


app = FastAPI(
    title="Bangladesh Climate Risk Assessment Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(geo_router)
app.include_router(indicators_router)
app.include_router(units_router)
app.include_router(sources_router)
app.include_router(scores_router)


@app.get("/")
async def root():
    return {"status": "success", "message": "Bangladesh Climate Risk Assessment Platform API"}
