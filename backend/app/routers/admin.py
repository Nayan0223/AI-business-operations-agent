"""Admin-only API routes: settings, DB table viewer, user management."""

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import engine, get_db

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_PIN = os.getenv("ADMIN_PIN", "1234")  # override via .env


# ── Auth ──────────────────────────────────────────────────────────────────────
class PinBody(BaseModel):
    pin: str


@router.post("/auth")
def verify_pin(body: PinBody):
    if body.pin != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    return {"ok": True}


# ── Settings ──────────────────────────────────────────────────────────────────
class SettingsPatch(BaseModel):
    openai_api_key: str | None = None
    openai_model: str | None = None
    admin_pin: str | None = None


@router.get("/settings")
def get_settings():
    key = settings.openai_api_key
    masked = ("•" * (len(key) - 4) + key[-4:]) if len(key) > 4 else ("•" * len(key))
    return {
        "app_name": settings.app_name,
        "openai_api_key_masked": masked if key else "",
        "openai_api_key_set": bool(key),
        "openai_model": settings.openai_model,
        "database_url_masked": _mask_db_url(settings.database_url),
        "cors_origins": settings.cors_origins,
    }


@router.patch("/settings")
def patch_settings(body: SettingsPatch):
    env_path = _find_env_file()
    lines = []
    if env_path.exists():
        lines = env_path.read_text().splitlines()

    updates: dict[str, str] = {}
    if body.openai_api_key is not None:
        updates["OPENAI_API_KEY"] = body.openai_api_key
        settings.openai_api_key = body.openai_api_key
    if body.openai_model is not None:
        updates["OPENAI_MODEL"] = body.openai_model
        settings.openai_model = body.openai_model
    if body.admin_pin is not None:
        updates["ADMIN_PIN"] = body.admin_pin
        os.environ["ADMIN_PIN"] = body.admin_pin

    new_lines: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key_part = line.split("=")[0].strip()
        if key_part in updates:
            new_lines.append(f"{key_part}={updates[key_part]}")
            seen.add(key_part)
        else:
            new_lines.append(line)
    for k, v in updates.items():
        if k not in seen:
            new_lines.append(f"{k}={v}")

    env_path.write_text("\n".join(new_lines) + "\n")
    return {"ok": True}


# ── Database viewer ───────────────────────────────────────────────────────────
@router.get("/db/tables")
def list_tables():
    insp = inspect(engine)
    return {"tables": insp.get_table_names()}


@router.get("/db/tables/{table}")
def table_rows(table: str, limit: int = 100, db: Session = Depends(get_db)):
    insp = inspect(engine)
    valid = insp.get_table_names()
    if table not in valid:
        raise HTTPException(status_code=404, detail="Table not found")
    cols = [c["name"] for c in insp.get_columns(table)]
    rows_raw = db.execute(text(f"SELECT * FROM {table} LIMIT :lim"), {"lim": limit}).fetchall()
    rows: list[dict[str, Any]] = [dict(zip(cols, r)) for r in rows_raw]
    count_raw = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
    return {"table": table, "columns": cols, "rows": rows, "total": count_raw}


# ── Users ───────────────────────────────────────────────────────────────────
@router.get("/users")
def list_users():
    return {
        "users": [
            {"id": 1, "name": "Admin", "role": "admin", "email": "admin@northline.local"},
        ]
    }


# ── Helpers ───────────────────────────────────────────────────────────────────
def _mask_db_url(url: str) -> str:
    if "@" in url:
        prefix, rest = url.rsplit("@", 1)
        scheme = prefix.split("://")[0]
        return f"{scheme}://***@{rest}"
    return url


def _find_env_file():
    from pathlib import Path
    candidates = [
        Path(__file__).resolve().parents[3] / "backend" / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]
