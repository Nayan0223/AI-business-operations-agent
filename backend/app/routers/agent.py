from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..agent.runner import run_agent
from ..db import get_db
from ..models import AgentMessage
from ..schemas import AgentAsk, AgentMessageOut
from ..services import dashboard, ops_brief

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    return dashboard(db)


@router.get("/brief")
def get_brief(db: Session = Depends(get_db)):
    return {"brief": ops_brief(db)}


@router.get("/agent/messages", response_model=list[AgentMessageOut])
def messages(db: Session = Depends(get_db)):
    return db.query(AgentMessage).order_by(AgentMessage.id.asc()).all()


@router.post("/agent/ask")
def ask(payload: AgentAsk, db: Session = Depends(get_db)):
    reply, used = run_agent(db, payload.message)
    return {"reply": reply, "tools_used": used}
