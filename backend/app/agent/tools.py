import json
from typing import Any, Callable

from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models
from ..services import dashboard, default_due, invoice_number, ops_brief


def _find_customer(db: Session, name: str | None = None, customer_id: int | None = None):
    if customer_id:
        return db.get(models.Customer, customer_id)
    if not name:
        return None
    q = db.query(models.Customer).filter(models.Customer.name.ilike(f"%{name}%"))
    row = q.first()
    if row:
        return row
    return db.query(models.Customer).filter(models.Customer.company.ilike(f"%{name}%")).first()


def tool_specs() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_ops_brief",
                "description": "Daily operations brief: cash, overdue invoices, tasks, inbox, low stock.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_customers",
                "description": "Search customers by name, company, email, or status.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "status": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_customer",
                "description": "Create a customer or lead.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "company": {"type": "string"},
                        "email": {"type": "string"},
                        "phone": {"type": "string"},
                        "status": {"type": "string"},
                        "notes": {"type": "string"},
                    },
                    "required": ["name", "email"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_invoices",
                "description": "List invoices, optionally filtered by status or customer.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "customer": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_invoice",
                "description": "Create an invoice for a customer.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer": {"type": "string"},
                        "amount": {"type": "number"},
                        "description": {"type": "string"},
                        "due_date": {"type": "string"},
                        "status": {"type": "string"},
                    },
                    "required": ["customer", "amount"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "mark_invoice_paid",
                "description": "Mark an invoice paid by number or id.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "number": {"type": "string"},
                        "invoice_id": {"type": "integer"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_inventory",
                "description": "List products. Set low_stock_only to find restock needs.",
                "parameters": {
                    "type": "object",
                    "properties": {"low_stock_only": {"type": "boolean"}},
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "adjust_stock",
                "description": "Set or change product quantity by sku or name.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sku": {"type": "string"},
                        "name": {"type": "string"},
                        "qty": {"type": "integer"},
                        "delta": {"type": "integer"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_tasks",
                "description": "List tasks. Filter by status or assignee.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "assignee": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Create an operations task.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "details": {"type": "string"},
                        "assignee": {"type": "string"},
                        "priority": {"type": "string"},
                        "due_date": {"type": "string"},
                    },
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "complete_task",
                "description": "Mark a task done by id or title match.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "integer"},
                        "title": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_inbox",
                "description": "List customer inquiries.",
                "parameters": {
                    "type": "object",
                    "properties": {"status": {"type": "string"}},
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "reply_inquiry",
                "description": "Reply to an inquiry by id.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "inquiry_id": {"type": "integer"},
                        "reply": {"type": "string"},
                    },
                    "required": ["inquiry_id", "reply"],
                },
            },
        },
    ]


def execute(db: Session, name: str, args: dict[str, Any]) -> Any:
    handlers: dict[str, Callable] = {
        "get_ops_brief": lambda: {"brief": ops_brief(db), **dashboard(db)},
        "search_customers": lambda: _search_customers(db, args),
        "create_customer": lambda: _create_customer(db, args),
        "list_invoices": lambda: _list_invoices(db, args),
        "create_invoice": lambda: _create_invoice(db, args),
        "mark_invoice_paid": lambda: _mark_paid(db, args),
        "list_inventory": lambda: _list_inventory(db, args),
        "adjust_stock": lambda: _adjust_stock(db, args),
        "list_tasks": lambda: _list_tasks(db, args),
        "create_task": lambda: _create_task(db, args),
        "complete_task": lambda: _complete_task(db, args),
        "list_inbox": lambda: _list_inbox(db, args),
        "reply_inquiry": lambda: _reply_inquiry(db, args),
    }
    if name not in handlers:
        return {"error": f"Unknown tool {name}"}
    return handlers[name]()


def _search_customers(db: Session, args: dict) -> list[dict]:
    q = db.query(models.Customer)
    query = (args.get("query") or "").strip()
    if query:
        like = f"%{query}%"
        q = q.filter(
            or_(
                models.Customer.name.ilike(like),
                models.Customer.company.ilike(like),
                models.Customer.email.ilike(like),
            )
        )
    if args.get("status"):
        q = q.filter(models.Customer.status == args["status"])
    return [
        {
            "id": c.id,
            "name": c.name,
            "company": c.company,
            "email": c.email,
            "status": c.status,
        }
        for c in q.limit(25)
    ]


def _create_customer(db: Session, args: dict) -> dict:
    c = models.Customer(
        name=args["name"],
        company=args.get("company") or "",
        email=args["email"],
        phone=args.get("phone") or "",
        status=args.get("status") or "lead",
        notes=args.get("notes") or "",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "email": c.email, "status": c.status}


def _list_invoices(db: Session, args: dict) -> list[dict]:
    q = db.query(models.Invoice)
    if args.get("status"):
        q = q.filter(models.Invoice.status == args["status"])
    if args.get("customer"):
        customer = _find_customer(db, args["customer"])
        if customer:
            q = q.filter(models.Invoice.customer_id == customer.id)
    rows = []
    for inv in q.order_by(models.Invoice.id.desc()).limit(30):
        customer = db.get(models.Customer, inv.customer_id)
        rows.append(
            {
                "id": inv.id,
                "number": inv.number,
                "amount": inv.amount,
                "status": inv.status,
                "due_date": inv.due_date,
                "customer": customer.name if customer else "",
            }
        )
    return rows


def _create_invoice(db: Session, args: dict) -> dict:
    customer = _find_customer(db, args.get("customer"))
    if not customer:
        return {"error": f"Customer not found: {args.get('customer')}"}
    amount = float(args["amount"])
    inv = models.Invoice(
        number=invoice_number(db),
        customer_id=customer.id,
        amount=amount,
        status=args.get("status") or "sent",
        due_date=args.get("due_date") or default_due(),
        description=args.get("description") or "",
    )
    db.add(inv)
    db.flush()
    db.add(
        models.InvoiceItem(
            invoice_id=inv.id,
            description=inv.description or "Services",
            qty=1,
            unit_price=amount,
        )
    )
    db.commit()
    db.refresh(inv)
    return {
        "id": inv.id,
        "number": inv.number,
        "amount": inv.amount,
        "customer": customer.name,
        "status": inv.status,
        "due_date": inv.due_date,
    }


def _mark_paid(db: Session, args: dict) -> dict:
    inv = None
    if args.get("invoice_id"):
        inv = db.get(models.Invoice, args["invoice_id"])
    elif args.get("number"):
        inv = db.query(models.Invoice).filter(models.Invoice.number == args["number"]).first()
    if not inv:
        return {"error": "Invoice not found"}
    inv.status = "paid"
    db.commit()
    return {"id": inv.id, "number": inv.number, "status": "paid", "amount": inv.amount}


def _list_inventory(db: Session, args: dict) -> list[dict]:
    q = db.query(models.Product)
    if args.get("low_stock_only"):
        q = q.filter(models.Product.qty <= models.Product.reorder_level)
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "qty": p.qty,
            "reorder_level": p.reorder_level,
            "low": p.qty <= p.reorder_level,
        }
        for p in q.all()
    ]


def _adjust_stock(db: Session, args: dict) -> dict:
    q = db.query(models.Product)
    product = None
    if args.get("sku"):
        product = q.filter(models.Product.sku.ilike(args["sku"])).first()
    if not product and args.get("name"):
        product = q.filter(models.Product.name.ilike(f"%{args['name']}%")).first()
    if not product:
        return {"error": "Product not found"}
    if args.get("qty") is not None:
        product.qty = int(args["qty"])
    elif args.get("delta") is not None:
        product.qty = max(0, product.qty + int(args["delta"]))
    else:
        return {"error": "Provide qty or delta"}
    db.commit()
    return {"sku": product.sku, "name": product.name, "qty": product.qty}


def _list_tasks(db: Session, args: dict) -> list[dict]:
    q = db.query(models.Task)
    if args.get("status"):
        q = q.filter(models.Task.status == args["status"])
    else:
        q = q.filter(models.Task.status != "done")
    if args.get("assignee"):
        q = q.filter(models.Task.assignee.ilike(f"%{args['assignee']}%"))
    return [
        {
            "id": t.id,
            "title": t.title,
            "assignee": t.assignee,
            "priority": t.priority,
            "status": t.status,
            "due_date": t.due_date,
        }
        for t in q.order_by(models.Task.id.desc()).limit(30)
    ]


def _create_task(db: Session, args: dict) -> dict:
    t = models.Task(
        title=args["title"],
        details=args.get("details") or "",
        assignee=args.get("assignee") or "Ops",
        priority=args.get("priority") or "medium",
        due_date=args.get("due_date") or "",
        status="open",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "title": t.title, "assignee": t.assignee, "priority": t.priority}


def _complete_task(db: Session, args: dict) -> dict:
    t = None
    if args.get("task_id"):
        t = db.get(models.Task, args["task_id"])
    elif args.get("title"):
        t = db.query(models.Task).filter(models.Task.title.ilike(f"%{args['title']}%")).first()
    if not t:
        return {"error": "Task not found"}
    t.status = "done"
    db.commit()
    return {"id": t.id, "title": t.title, "status": "done"}


def _list_inbox(db: Session, args: dict) -> list[dict]:
    q = db.query(models.Inquiry)
    if args.get("status"):
        q = q.filter(models.Inquiry.status == args["status"])
    else:
        q = q.filter(models.Inquiry.status == "open")
    return [
        {
            "id": i.id,
            "sender": i.sender,
            "subject": i.subject,
            "status": i.status,
            "body": i.body[:280],
        }
        for i in q.order_by(models.Inquiry.id.desc()).limit(20)
    ]


def _reply_inquiry(db: Session, args: dict) -> dict:
    row = db.get(models.Inquiry, args["inquiry_id"])
    if not row:
        return {"error": "Inquiry not found"}
    row.reply = args["reply"]
    row.status = "replied"
    db.commit()
    return {"id": row.id, "subject": row.subject, "status": "replied"}


def dump(value: Any) -> str:
    return json.dumps(value, default=str)
