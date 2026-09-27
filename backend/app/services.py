from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models


def invoice_number(db: Session) -> str:
    count = db.query(func.count(models.Invoice.id)).scalar() or 0
    return f"NL-{1001 + count}"


def compute_amount(items: list) -> float:
    return round(sum(i.qty * i.unit_price for i in items), 2)


def dashboard(db: Session) -> dict:
    customers = db.query(func.count(models.Customer.id)).scalar() or 0
    open_tasks = (
        db.query(func.count(models.Task.id)).filter(models.Task.status != "done").scalar() or 0
    )
    open_inbox = (
        db.query(func.count(models.Inquiry.id)).filter(models.Inquiry.status == "open").scalar() or 0
    )
    invoices = db.query(models.Invoice).all()
    paid = sum(i.amount for i in invoices if i.status == "paid")
    outstanding = sum(i.amount for i in invoices if i.status in ("sent", "overdue", "draft"))
    overdue = [i for i in invoices if i.status == "overdue"]
    low_stock = (
        db.query(models.Product)
        .filter(models.Product.qty <= models.Product.reorder_level)
        .all()
    )
    recent_tasks = (
        db.query(models.Task).order_by(models.Task.created_at.desc()).limit(6).all()
    )
    activity = []
    for inv in db.query(models.Invoice).order_by(models.Invoice.created_at.desc()).limit(4):
        activity.append(
            {
                "kind": "invoice",
                "label": f"{inv.number} · ${inv.amount:,.0f}",
                "meta": inv.status,
            }
        )
    for inq in db.query(models.Inquiry).order_by(models.Inquiry.created_at.desc()).limit(3):
        activity.append({"kind": "inbox", "label": inq.subject, "meta": inq.status})

    return {
        "customers": customers,
        "open_tasks": open_tasks,
        "open_inbox": open_inbox,
        "paid_revenue": round(paid, 2),
        "outstanding": round(outstanding, 2),
        "overdue_count": len(overdue),
        "overdue_amount": round(sum(i.amount for i in overdue), 2),
        "low_stock": [
            {"id": p.id, "sku": p.sku, "name": p.name, "qty": p.qty, "reorder_level": p.reorder_level}
            for p in low_stock
        ],
        "recent_tasks": [
            {
                "id": t.id,
                "title": t.title,
                "priority": t.priority,
                "status": t.status,
                "assignee": t.assignee,
            }
            for t in recent_tasks
        ],
        "activity": activity[:8],
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def ops_brief(db: Session) -> str:
    d = dashboard(db)
    low = ", ".join(f"{p['name']} ({p['qty']})" for p in d["low_stock"]) or "none"
    return (
        f"Northline daily brief — {datetime.utcnow().strftime('%d %b %Y')}\n"
        f"Cash collected: ${d['paid_revenue']:,.0f}. Outstanding: ${d['outstanding']:,.0f} "
        f"({d['overdue_count']} overdue invoices totaling ${d['overdue_amount']:,.0f}).\n"
        f"Pipeline: {d['customers']} accounts. Open work: {d['open_tasks']} tasks, "
        f"{d['open_inbox']} unread inquiries.\n"
        f"Restock needed: {low}."
    )


def mark_overdue(db: Session) -> None:
    today = datetime.utcnow().date().isoformat()
    for inv in db.query(models.Invoice).filter(models.Invoice.status == "sent").all():
        if inv.due_date and inv.due_date < today:
            inv.status = "overdue"
    db.commit()


def default_due(days: int = 14) -> str:
    return (datetime.utcnow() + timedelta(days=days)).date().isoformat()
