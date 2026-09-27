from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .services import invoice_number


def seed_if_empty(db: Session) -> None:
    if db.query(models.Customer).first():
        return

    today = datetime.utcnow().date()
    customers = [
        models.Customer(
            name="Priya Mehta",
            company="Lumen Retail",
            email="priya@lumenretail.com",
            phone="+91 98200 11122",
            status="active",
            notes="Prefers monthly retainers. Expanding to 4 stores.",
        ),
        models.Customer(
            name="James Okonkwo",
            company="Harbor Logistics",
            email="james@harborlog.co",
            phone="+1 415 555 0198",
            status="active",
            notes="SLA-sensitive. Needs same-day ops replies.",
        ),
        models.Customer(
            name="Sofia Alvarez",
            company="Atelier Norte",
            email="sofia@ateliernorte.com",
            phone="+34 611 440 221",
            status="lead",
            notes="Quoted warehouse software add-on.",
        ),
        models.Customer(
            name="Arjun Patel",
            company="Kite Foods",
            email="arjun@kitefoods.in",
            phone="+91 98765 44321",
            status="active",
            notes="Seasonal inventory spikes in Q4.",
        ),
        models.Customer(
            name="Elena Rossi",
            company="Vespera Clinics",
            email="elena@vespera.care",
            phone="+39 06 555 8833",
            status="churned",
            notes="Paused after budget freeze. Revisit in Q1.",
        ),
    ]
    db.add_all(customers)
    db.flush()

    products = [
        models.Product(sku="NL-PACK-01", name="Ops starter kit", qty=42, reorder_level=15, unit_cost=89, category="kits"),
        models.Product(sku="NL-SCAN-12", name="Handheld scanner", qty=8, reorder_level=12, unit_cost=210, category="hardware"),
        models.Product(sku="NL-LBL-80", name="Thermal labels (roll)", qty=120, reorder_level=40, unit_cost=12, category="consumable"),
        models.Product(sku="NL-SUB-PRO", name="Northline Pro seat", qty=500, reorder_level=50, unit_cost=29, category="software"),
        models.Product(sku="NL-RACK-A", name="Compact rack unit", qty=3, reorder_level=6, unit_cost=640, category="hardware"),
    ]
    db.add_all(products)
    db.flush()

    invoices_spec = [
        (customers[0], "sent", 2400, 5, "Monthly ops retainer"),
        (customers[0], "paid", 1800, -20, "Store launch playbook"),
        (customers[1], "overdue", 4200, -4, "SLA coverage Q3"),
        (customers[1], "paid", 3100, -40, "Route optimization sprint"),
        (customers[3], "sent", 960, 10, "Cold-chain sensors"),
        (customers[2], "draft", 5400, 21, "Warehouse software add-on"),
    ]
    for customer, status, amount, due_offset, desc in invoices_spec:
        inv = models.Invoice(
            number=invoice_number(db),
            customer_id=customer.id,
            amount=amount,
            status=status,
            due_date=(today + timedelta(days=due_offset)).isoformat(),
            description=desc,
        )
        db.add(inv)
        db.flush()
        db.add(
            models.InvoiceItem(
                invoice_id=inv.id,
                description=desc,
                qty=1,
                unit_price=amount,
            )
        )

    tasks = [
        models.Task(
            title="Chase Harbor Logistics overdue invoice",
            details="NL overdue — call James before Friday.",
            assignee="Maya",
            priority="high",
            status="open",
            due_date=today.isoformat(),
        ),
        models.Task(
            title="Restock handheld scanners",
            details="Qty is under reorder level.",
            assignee="Dev",
            priority="high",
            status="open",
            due_date=(today + timedelta(days=2)).isoformat(),
        ),
        models.Task(
            title="Send Atelier Norte proposal",
            details="Include 90-day implementation timeline.",
            assignee="Priya",
            priority="medium",
            status="open",
            due_date=(today + timedelta(days=3)).isoformat(),
        ),
        models.Task(
            title="Q3 cash collection review",
            details="Compare paid vs outstanding by account.",
            assignee="Ops",
            priority="low",
            status="done",
            due_date=(today - timedelta(days=2)).isoformat(),
        ),
        models.Task(
            title="Reply to Kite Foods delivery window",
            details="They asked for Sunday dispatch.",
            assignee="Maya",
            priority="medium",
            status="open",
            due_date=(today + timedelta(days=1)).isoformat(),
        ),
    ]
    db.add_all(tasks)

    inquiries = [
        models.Inquiry(
            sender="Arjun Patel",
            email="arjun@kitefoods.in",
            subject="Sunday dispatch possible?",
            body="Can you fulfill SKU NL-LBL-80 on Sunday if we confirm by Thursday noon?",
            status="open",
        ),
        models.Inquiry(
            sender="Sofia Alvarez",
            email="sofia@ateliernorte.com",
            subject="Implementation timeline",
            body="How long from kickoff until the warehouse add-on is live for 2 sites?",
            status="open",
        ),
        models.Inquiry(
            sender="James Okonkwo",
            email="james@harborlog.co",
            subject="Invoice NL discrepancy",
            body="We were billed for SLA coverage — can you resend the breakdown?",
            status="open",
        ),
        models.Inquiry(
            sender="Priya Mehta",
            email="priya@lumenretail.com",
            subject="Thanks for the playbook",
            body="The launch playbook worked. We will expand to a fifth store in November.",
            status="replied",
            reply="Wonderful — I'll hold a November onboarding slot and send a fifth-store quote.",
        ),
    ]
    db.add_all(inquiries)

    db.add(
        models.AgentMessage(
            role="assistant",
            content="Northline ops desk is live. Ask me to draft invoices, chase overdue accounts, restock, or brief the day.",
            tools_used="",
        )
    )
    db.commit()
