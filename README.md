<div align="center">

<!-- Header Banner -->
<br/>

```
 ███╗   ██╗ ██████╗ ██████╗ ████████╗██╗  ██╗██╗     ██╗███╗   ██╗███████╗
 ████╗  ██║██╔═══██╗██╔══██╗╚══██╔══╝██║  ██║██║     ██║████╗  ██║██╔════╝
 ██╔██╗ ██║██║   ██║██████╔╝   ██║   ███████║██║     ██║██╔██╗ ██║█████╗  
 ██║╚██╗██║██║   ██║██╔══██╗   ██║   ██╔══██║██║     ██║██║╚██╗██║██╔══╝  
 ██║ ╚████║╚██████╔╝██║  ██║   ██║   ██║  ██║███████╗██║██║ ╚████║███████╗
 ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝
```

<h3>AI Business Operations Desk</h3>

<p><em>CRM · Invoices · Inventory · Tasks · Inbox — all wired to an AI agent that can actually change your records.</em></p>

<br/>

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tests](https://img.shields.io/badge/Tests-30%20passing-C8F250?style=for-the-badge&logo=pytest&logoColor=black)](#-testing)

<br/>

</div>

---

## ✨ What is Northline?

**Northline** is a self-hosted AI operations desk for small businesses and ops teams. It gives you a full business management UI — accounts, ledger, stock, work queue, and inbox — plus an **intelligent agent** that understands natural language and can create invoices, restock products, close tasks, and reply to customers on your behalf.

Works **entirely offline** with no API key needed. Drop in an OpenAI key for a smarter cloud model.

---

## 🖥️ Screenshots

<table>
<tr>
<td width="50%">

### ⬡ Operations Floor
Real-time dashboard with cash collected, outstanding invoices, restock pulse, live tape, and task queue.

</td>
<td width="50%">

### ◈ AI Agent
Natural-language chat interface. Ask for a brief, create an invoice, chase overdue — all in plain English.

</td>
</tr>
<tr>
<td>

> _Dashboard view showing metrics, restock pulse, live tape, and queue panels_

</td>
<td>

> _Agent chat with typing indicator, suggestion chips, and tool usage traces_

</td>
</tr>
</table>

---

## 🚀 Features

<table>
<tr>
<td width="50%">

**📊 Operations Dashboard**
- Cash collected vs outstanding
- Collection rate progress bar
- Low-stock restock pulse
- Live activity tape
- Priority task queue

**👥 CRM — Accounts**
- Create & edit customers
- Status: lead / active / churned
- Search by name, company, email
- Inline edit without leaving the table

**📄 Ledger — Invoices**
- Issue, mark paid, void invoices
- Filter by status (sent / paid / overdue / void)
- Auto-generated `NL-XXXX` numbers
- Customer name resolution

</td>
<td width="50%">

**📦 Inventory — Stock**
- SKU management with reorder levels
- Low-stock filter / All toggle
- `+10`, `+5`, `−1` quick-adjust buttons
- Category & unit cost tracking

**✅ Work Queue — Tasks**
- Open / Done / All filter with counts
- Priority: high / medium / low
- Assignee + due date
- One-click complete

**📬 Customer Inbox**
- Threaded inquiry view
- Open / Replied / All filter
- Reply directly from the UI
- Agent can auto-reply

</td>
</tr>
</table>

---

## ◈ The Agent

The built-in desk agent understands natural language and has **live tool access** to every module:

```
"Give me the daily brief"
"Show overdue invoices"
"Create invoice for Harbor Logistics for 1500"
"Mark NL-1003 paid"
"What is low in stock?"
"List open tasks"
"Reply to inquiry 2: we can dispatch Sunday"
```

| Mode | How it works |
|---|---|
| **No API key** | Rule-based local agent — instant, no cost, works offline |
| **OpenAI key set** | GPT-4o-mini with full tool-calling loop (up to 6 turns) |

The agent stores conversation history and falls back to the local agent if the cloud is unavailable.

---

## ⚡ Quick Start

### 1 · Backend API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional: add OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

### 2 · Frontend UI

```bash
# In a second terminal
cd frontend
npm install
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** — demo data loads automatically.

### 3 · Optional: OpenAI Agent

```bash
# Add your key to backend/.env
echo "OPENAI_API_KEY=sk-..." >> backend/.env
# Restart uvicorn — GPT-4o-mini will power the agent
```

---

## 🧪 Testing

30 tests covering every API endpoint and agent command:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest -q
```

```
..............................
30 passed in 0.67s ✅
```

**Test coverage:**

| Module | Tests |
|---|---|
| Health & Dashboard | 3 |
| Customers CRUD | 4 |
| Invoices CRUD | 5 |
| Products & Stock | 3 |
| Tasks | 3 |
| Inbox | 4 |
| Agent (all commands) | 5 |
| Edge cases (404, 400, floor-at-0) | 3 |

---

## 🗂️ Project Layout

```
AI-business-operations-agent/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── runner.py       ← OpenAI loop + local fallback
│   │   │   └── tools.py        ← 13 live tool implementations
│   │   ├── routers/
│   │   │   ├── ops.py          ← CRUD endpoints (customers, invoices, …)
│   │   │   └── agent.py        ← /agent/ask  /agent/messages  /brief
│   │   ├── models.py           ← SQLAlchemy ORM models
│   │   ├── schemas.py          ← Pydantic request/response schemas
│   │   ├── services.py         ← Dashboard, brief, overdue logic
│   │   ├── seed.py             ← Demo company data
│   │   ├── config.py           ← Settings (env vars)
│   │   └── main.py             ← FastAPI app + CORS + static serving
│   ├── tests/
│   │   └── test_api.py         ← 30-test comprehensive suite
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── App.tsx             ← All 7 views + components
│       ├── api.ts              ← Typed API client
│       ├── styles.css          ← Premium dark design system
│       └── main.tsx
│
└── README.md
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/dashboard` | Full ops dashboard |
| `GET` | `/api/brief` | Ops brief (text) |
| `GET/POST` | `/api/customers` | List / create customers |
| `PATCH` | `/api/customers/{id}` | Update customer |
| `GET/POST` | `/api/invoices` | List / create invoices |
| `PATCH` | `/api/invoices/{id}/status` | Update invoice status |
| `GET/POST` | `/api/products` | List / create products |
| `PATCH` | `/api/products/{id}/stock` | Adjust stock (qty or delta) |
| `GET/POST` | `/api/tasks` | List / create tasks |
| `PATCH` | `/api/tasks/{id}` | Update task |
| `GET/POST` | `/api/inbox` | List / create inquiries |
| `POST` | `/api/inbox/{id}/reply` | Reply to inquiry |
| `GET` | `/api/agent/messages` | Message history |
| `POST` | `/api/agent/ask` | Send message to agent |

Interactive docs available at **[http://localhost:8000/docs](http://localhost:8000/docs)** when the API is running.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **API** | FastAPI 0.115 · Uvicorn · Python 3.11+ |
| **Database** | SQLite · SQLAlchemy 2.0 (ORM) |
| **Validation** | Pydantic 2 · pydantic-settings |
| **AI** | OpenAI SDK (optional) · built-in rule-based agent |
| **Frontend** | React 18 · TypeScript 5.6 · Vite 5 |
| **Styling** | Vanilla CSS · Inter · Fraunces · IBM Plex Mono |
| **Tests** | pytest 8 · FastAPI TestClient |

---

## 🌱 Seed Data

The app ships with a ready-to-use demo company:

| Entity | Count | Details |
|---|---|---|
| **Customers** | 5 | Priya Mehta, James Okonkwo, Sofia Alvarez, Arjun Patel, Elena Rossi |
| **Invoices** | 6 | Mix of paid, sent, overdue, draft |
| **Products** | 5 | Ops kit, handheld scanner, thermal labels, Pro seat, rack unit |
| **Tasks** | 5 | High/medium/low priority, one already done |
| **Inquiries** | 4 | Three open, one replied |

---

## 🛠️ Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | _(empty)_ | Optional — enables GPT-4o-mini agent |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use when key is set |
| `DATABASE_URL` | `sqlite:///./ops.db` | Database connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |

Set in `backend/.env` (copy from `.env.example`).

---

## 🚢 Production Deployment

```bash
# Build the frontend bundle
cd frontend && npm run build

# Serve everything from the API on port 8000
# FastAPI auto-serves /frontend/dist when it exists
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API serves the compiled React app from `/` and the API from `/api/*` — single process, single port.

---

<div align="center">

<br/>

**Built with FastAPI · React · SQLite · ❤️**

<br/>

</div>
