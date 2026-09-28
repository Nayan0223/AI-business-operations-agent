from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401
from .config import settings
from .db import Base, SessionLocal, engine
from .routers import admin, agent, ops
from .seed import seed_if_empty
from .services import mark_overdue


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
        mark_overdue(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


init_db()

app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    + ["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ops.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True, "name": settings.app_name}


dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=dist, html=True), name="ui")
