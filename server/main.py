"""Full-stack API.  Run from the project root:   uvicorn server.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from server import config, db, services
from server.routers import admin, auth, compare, contracts, feedback
from src.predict import get_models


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    services.mark_interrupted_jobs()
    get_models()          # load (or train) the models once at startup so the first request is fast
    yield


app = FastAPI(title="Legal Risk Platform API", version="5.0", lifespan=lifespan,
              description="Auth, contract storage, background analysis, comparison and a feedback-review loop "
                          "around the clause-risk ML engine. Not legal advice.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

# Prometheus metrics at /metrics (request rate, latency, status codes). nginx only forwards /api/, so this
# endpoint is reachable from the internal Docker network only.
Instrumentator(excluded_handlers=["/metrics", "/api/health"]).instrument(app).expose(
    app, endpoint="/metrics", include_in_schema=False)

for module in (auth, contracts, feedback, compare, admin):
    app.include_router(module.router)


@app.get("/api/health", tags=["health"])
def health():
    try:
        get_models()
        return {"status": "ok", "models_loaded": True}
    except Exception:
        return {"status": "degraded", "models_loaded": False}
