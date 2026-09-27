# AI Business Operations Agent

Northline is a local **AI operations desk**: CRM, invoices, inventory, tasks, and a customer inbox, plus an agent that can actually change those records.

The original repo only had a placeholder. This is the full working product.

## What you get

- Dashboard with cash collected, outstanding, overdue, restock alerts
- Accounts, ledger, stock, work queue, and inbox screens
- An operations agent with tools (brief, invoices, stock, tasks, replies)
- Seeded demo company so you can click around immediately
- Works **without** an OpenAI key (built-in desk agent). Add a key for a stronger model.

## Run it

**API**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optional: paste OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

**UI** (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Optional: `cd frontend && npm run build`, then the API also serves the UI from `/` on port 8000.

## Try the agent

- “Give me the daily brief”
- “Show overdue invoices”
- “Create invoice for Harbor Logistics for 1500”
- “Mark NL-1003 paid”
- “What is low in stock?”

## Tests

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest -q
```

## Layout

- `backend/app` — FastAPI, SQLite, agent tools
- `frontend/src` — React operations console
- `well.py` — leftover hello from the empty starter; the real app is above
