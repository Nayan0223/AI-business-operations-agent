"""
Comprehensive API test suite for Northline Ops.
Run from backend/: PYTHONPATH=. pytest -q
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ── Health ──────────────────────────────────────────────────────────────────
class TestHealth:
    def test_health_ok(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert "name" in r.json()


# ── Dashboard ────────────────────────────────────────────────────────────────
class TestDashboard:
    def test_dashboard_seeded(self):
        r = client.get("/api/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert data["customers"] >= 5
        assert "paid_revenue" in data
        assert "outstanding" in data
        assert "overdue_count" in data
        assert "low_stock" in data
        assert "activity" in data
        assert "recent_tasks" in data

    def test_brief_returns_text(self):
        r = client.get("/api/brief")
        assert r.status_code == 200
        brief = r.json()["brief"]
        assert "Northline" in brief
        assert "Outstanding" in brief


# ── Customers ────────────────────────────────────────────────────────────────
class TestCustomers:
    def test_list_customers(self):
        r = client.get("/api/customers")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_search_customers(self):
        r = client.get("/api/customers?q=harbor")
        assert r.status_code == 200
        results = r.json()
        assert any("harbor" in c["company"].lower() for c in results)

    def test_create_customer(self):
        payload = {
            "name": "Test User",
            "company": "Test Co",
            "email": "test@testco.com",
            "phone": "",
            "status": "lead",
            "notes": "",
        }
        r = client.post("/api/customers", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Test User"
        assert data["status"] == "lead"
        assert data["id"] > 0

    def test_update_customer(self):
        # Create first
        r = client.post(
            "/api/customers",
            json={"name": "Update Me", "email": "update@test.com", "status": "lead"},
        )
        cid = r.json()["id"]
        # Update
        r2 = client.patch(
            f"/api/customers/{cid}",
            json={"name": "Updated", "email": "update@test.com", "status": "active",
                  "company": "", "phone": "", "notes": ""},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "active"
        assert r2.json()["name"] == "Updated"

    def test_update_nonexistent_customer(self):
        r = client.patch(
            "/api/customers/99999",
            json={"name": "Ghost", "email": "ghost@nowhere.com", "status": "lead",
                  "company": "", "phone": "", "notes": ""},
        )
        assert r.status_code == 404


# ── Invoices ─────────────────────────────────────────────────────────────────
class TestInvoices:
    def _first_customer_id(self):
        return client.get("/api/customers").json()[0]["id"]

    def test_list_invoices(self):
        r = client.get("/api/invoices")
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_list_invoices_filtered_by_status(self):
        r = client.get("/api/invoices?status=paid")
        assert r.status_code == 200
        for inv in r.json():
            assert inv["status"] == "paid"

    def test_create_invoice(self):
        cid = self._first_customer_id()
        r = client.post(
            "/api/invoices",
            json={"customer_id": cid, "amount": 125, "due_date": "2099-01-01", "description": "Test invoice"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["number"].startswith("NL-")
        assert data["amount"] == 125
        assert data["status"] == "sent"

    def test_mark_invoice_paid(self):
        cid = self._first_customer_id()
        inv = client.post(
            "/api/invoices",
            json={"customer_id": cid, "amount": 99, "due_date": "2099-06-01"},
        ).json()
        r = client.patch(f"/api/invoices/{inv['id']}/status?status=paid")
        assert r.status_code == 200
        assert r.json()["status"] == "paid"

    def test_mark_invoice_void(self):
        cid = self._first_customer_id()
        inv = client.post(
            "/api/invoices",
            json={"customer_id": cid, "amount": 50, "due_date": "2099-06-01"},
        ).json()
        r = client.patch(f"/api/invoices/{inv['id']}/status?status=void")
        assert r.status_code == 200
        assert r.json()["status"] == "void"

    def test_invalid_invoice_status(self):
        cid = self._first_customer_id()
        inv = client.post(
            "/api/invoices",
            json={"customer_id": cid, "amount": 50, "due_date": "2099-06-01"},
        ).json()
        r = client.patch(f"/api/invoices/{inv['id']}/status?status=banana")
        assert r.status_code == 400


# ── Products ─────────────────────────────────────────────────────────────────
class TestProducts:
    def test_list_products(self):
        r = client.get("/api/products")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_create_product(self):
        r = client.post(
            "/api/products",
            json={"sku": "TEST-001", "name": "Test Product", "qty": 50, "reorder_level": 10, "unit_cost": 25},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["sku"] == "TEST-001"
        assert data["qty"] == 50

    def test_stock_delta(self):
        # Create
        prod = client.post(
            "/api/products",
            json={"sku": "TEST-DELTA", "name": "Delta Product", "qty": 20, "reorder_level": 5, "unit_cost": 0},
        ).json()
        pid = prod["id"]
        # Increase
        r = client.patch(f"/api/products/{pid}/stock", json={"delta": 10})
        assert r.status_code == 200
        assert r.json()["qty"] == 30
        # Decrease
        r2 = client.patch(f"/api/products/{pid}/stock", json={"delta": -5})
        assert r2.json()["qty"] == 25
        # Set absolute
        r3 = client.patch(f"/api/products/{pid}/stock", json={"qty": 100})
        assert r3.json()["qty"] == 100

    def test_stock_cannot_go_negative(self):
        prod = client.post(
            "/api/products",
            json={"sku": "TEST-NEG", "name": "Negative Test", "qty": 3, "reorder_level": 5, "unit_cost": 0},
        ).json()
        r = client.patch(f"/api/products/{prod['id']}/stock", json={"delta": -999})
        assert r.status_code == 200
        assert r.json()["qty"] == 0  # Floor at 0


# ── Tasks ────────────────────────────────────────────────────────────────────
class TestTasks:
    def test_list_tasks(self):
        r = client.get("/api/tasks")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_create_task(self):
        r = client.post(
            "/api/tasks",
            json={"title": "Test task", "priority": "high", "assignee": "QA"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "Test task"
        assert data["status"] == "open"

    def test_complete_task(self):
        task = client.post(
            "/api/tasks",
            json={"title": "Complete me", "priority": "low"},
        ).json()
        r = client.patch(
            f"/api/tasks/{task['id']}",
            json={**task, "status": "done"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "done"


# ── Inbox ────────────────────────────────────────────────────────────────────
class TestInbox:
    def test_list_inbox(self):
        r = client.get("/api/inbox")
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_create_inquiry(self):
        r = client.post(
            "/api/inbox",
            json={
                "sender": "Test Sender",
                "email": "sender@test.com",
                "subject": "Test subject",
                "body": "This is a test inquiry body.",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "open"
        assert data["reply"] == ""

    def test_reply_inquiry(self):
        inq = client.post(
            "/api/inbox",
            json={"sender": "Alice", "email": "alice@test.com", "subject": "Question", "body": "..."},
        ).json()
        r = client.post(
            f"/api/inbox/{inq['id']}/reply",
            json={"reply": "Thanks for reaching out!"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "replied"
        assert "Thanks" in data["reply"]

    def test_reply_nonexistent_inquiry(self):
        r = client.post("/api/inbox/99999/reply", json={"reply": "Ghost reply"})
        assert r.status_code == 404


# ── Agent ────────────────────────────────────────────────────────────────────
class TestAgent:
    def test_daily_brief(self):
        r = client.post("/api/agent/ask", json={"message": "Give me the daily brief"})
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data
        assert "Outstanding" in data["reply"]

    def test_list_invoices_via_agent(self):
        r = client.post("/api/agent/ask", json={"message": "Show overdue invoices"})
        assert r.status_code == 200
        assert "reply" in r.json()

    def test_stock_query_via_agent(self):
        r = client.post("/api/agent/ask", json={"message": "What is low in stock?"})
        assert r.status_code == 200
        assert "reply" in r.json()

    def test_agent_messages_history(self):
        r = client.get("/api/agent/messages")
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 1
        assert all("role" in m and "content" in m for m in msgs)

    def test_create_invoice_via_agent(self):
        r = client.post(
            "/api/agent/ask",
            json={"message": "Create invoice for Harbor Logistics for 750"},
        )
        assert r.status_code == 200
        reply = r.json()["reply"]
        # Should mention NL- invoice number
        assert "NL-" in reply or "Harbor" in reply or "750" in reply
