from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_dashboard_seeded():
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert data["customers"] >= 5
    assert "paid_revenue" in data


def test_create_invoice_and_agent_brief():
    customers = client.get("/api/customers").json()
    cid = customers[0]["id"]
    inv = client.post(
        "/api/invoices",
        json={"customer_id": cid, "amount": 125, "due_date": "2099-01-01", "description": "Test"},
    )
    assert inv.status_code == 200
    assert inv.json()["number"].startswith("NL-")

    ask = client.post("/api/agent/ask", json={"message": "Give me the daily brief"})
    assert ask.status_code == 200
    assert "Outstanding" in ask.json()["reply"]
