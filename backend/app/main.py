import logging
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
from app.api.simulation import router as simulation_router
from app.api.risk_index import router as risk_index_router
from app.api.exports import router as exports_router
from app.api.audit import router as audit_router
from app.scripts.seed_superadmin import seed_superadmin

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_superadmin()
    yield


app = FastAPI(
    title="Bangladesh Climate Risk Assessment Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — parse origins and reject wildcards in production
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if settings.ENVIRONMENT == "production" and "*" in origins:
    logger.warning("CORS wildcard '*' is not allowed in production — ignoring")
    origins = [o for o in origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(geo_router)
app.include_router(indicators_router)
app.include_router(units_router)
app.include_router(sources_router)
app.include_router(scores_router)
app.include_router(simulation_router)
app.include_router(risk_index_router)
app.include_router(exports_router)
app.include_router(audit_router)


@app.get("/")
async def root():
    return {"status": "success", "message": "Bangladesh Climate Risk Assessment Platform API"}
