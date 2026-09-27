import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AgentMsg,
  Customer,
  Dashboard,
  Inquiry,
  Invoice,
  Product,
  Task,
  api,
  money,
} from "./api";

type View = "desk" | "agent" | "customers" | "invoices" | "stock" | "tasks" | "inbox";

const nav: { id: View; label: string; kicker: string }[] = [
  { id: "desk", label: "Floor", kicker: "01" },
  { id: "agent", label: "Agent", kicker: "02" },
  { id: "customers", label: "Accounts", kicker: "03" },
  { id: "invoices", label: "Ledger", kicker: "04" },
  { id: "stock", label: "Stock", kicker: "05" },
  { id: "tasks", label: "Work", kicker: "06" },
  { id: "inbox", label: "Inbox", kicker: "07" },
];

export function App() {
  const [view, setView] = useState<View>("desk");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  async function refreshDash() {
    try {
      setDash(await api.dashboard());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "API unavailable");
    }
  }

  useEffect(() => {
    refreshDash();
  }, [view]);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="mark" />
          <div>
            <p className="eyebrow">Northline</p>
            <h1>Ops desk</h1>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.kicker}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <p className="rail-foot">Local agent · SQLite · live tools</p>
      </aside>
      <main>
        {error && <div className="banner">{error}. Start the API on port 8000.</div>}
        {view === "desk" && dash && <Desk dash={dash} go={setView} />}
        {view === "agent" && <Agent />}
        {view === "customers" && <Customers />}
        {view === "invoices" && <Invoices />}
        {view === "stock" && <Stock />}
        {view === "tasks" && <Tasks />}
        {view === "inbox" && <Inbox />}
      </main>
    </div>
  );
}

function Desk({ dash, go }: { dash: Dashboard; go: (v: View) => void }) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Sunday floor</p>
          <h2>The desk is already working.</h2>
        </div>
        <button className="ghost" onClick={() => go("agent")}>
          Ask the agent
        </button>
      </header>
      <div className="metrics">
        <Metric label="Collected" value={money(dash.paid_revenue)} hint="paid invoices" />
        <Metric label="Outstanding" value={money(dash.outstanding)} hint={`${dash.overdue_count} overdue`} />
        <Metric label="Accounts" value={String(dash.customers)} hint="in the book" />
        <Metric label="Open work" value={String(dash.open_tasks)} hint={`${dash.open_inbox} unread`} />
      </div>
      <div className="split">
        <article className="panel">
          <h3>Restock pulse</h3>
          {dash.low_stock.length === 0 && <p className="muted">Nothing under reorder.</p>}
          <ul className="rows">
            {dash.low_stock.map((p) => (
              <li key={p.id}>
                <b>{p.name}</b>
                <span>
                  {p.qty} / {p.reorder_level}
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Live tape</h3>
          <ul className="rows">
            {dash.activity.map((a, i) => (
              <li key={i}>
                <b>{a.label}</b>
                <em>{a.meta}</em>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Queue</h3>
          <ul className="rows">
            {dash.recent_tasks.map((t) => (
              <li key={t.id}>
                <b>{t.title}</b>
                <span className={`pill ${t.priority}`}>{t.priority}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function Agent() {
  const [msgs, setMsgs] = useState<AgentMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const prompts = [
    "Give me the daily brief",
    "Show overdue invoices",
    "Create invoice for Harbor Logistics for 1500",
    "What is low in stock?",
  ];

  useEffect(() => {
    api.messages().then(setMsgs).catch(() => undefined);
  }, []);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setText("");
    setMsgs((m) => [...m, { id: Date.now(), role: "user", content: message, tools_used: "" }]);
    try {
      const res = await api.ask(message);
      setMsgs((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: res.reply,
          tools_used: res.tools_used.join(","),
        },
      ]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: e instanceof Error ? e.message : "Failed",
          tools_used: "",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page agent-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Northline agent</p>
          <h2>Talk to the operation.</h2>
        </div>
      </header>
      <div className="chips">
        {prompts.map((p) => (
          <button key={p} onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="transcript">
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            <p>{m.content}</p>
            {m.tools_used && <small>tools · {m.tools_used}</small>}
          </div>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={busy ? "Working the books…" : "Raise an invoice, restock, brief the day…"}
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </section>
  );
}

function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "lead",
    notes: "",
  });

  async function load(query = q) {
    setRows(await api.customers(query));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.createCustomer(form);
    setForm({ name: "", company: "", email: "", phone: "", status: "lead", notes: "" });
    await load();
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">CRM</p>
          <h2>Accounts on the book.</h2>
        </div>
        <input
          className="search"
          placeholder="Search name, company, email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </header>
      <form className="create" onSubmit={onSubmit}>
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="lead">lead</option>
          <option value="active">active</option>
          <option value="churned">churned</option>
        </select>
        <button type="submit">Add account</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Email</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.company}</td>
              <td>{c.email}</td>
              <td>
                <span className={`pill ${c.status}`}>{c.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Invoices() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ customer_id: 0, amount: 0, due_date: "", description: "" });

  async function load() {
    const [inv, cus] = await Promise.all([api.invoices(), api.customers()]);
    setRows(inv);
    setCustomers(cus);
    if (!form.customer_id && cus[0]) setForm((f) => ({ ...f, customer_id: cus[0].id }));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.createInvoice(form);
    await load();
  }

  const total = useMemo(
    () => rows.filter((r) => r.status !== "paid" && r.status !== "void").reduce((s, r) => s + r.amount, 0),
    [rows]
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Ledger</p>
          <h2>Open {money(total)}</h2>
        </div>
      </header>
      <form className="create" onSubmit={onSubmit}>
        <select
          value={form.customer_id}
          onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          required
          placeholder="Amount"
          value={form.amount || ""}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
        />
        <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button type="submit">Issue invoice</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Account</th>
            <th>Amount</th>
            <th>Due</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">{r.number}</td>
              <td>{r.customer_name}</td>
              <td>{money(r.amount)}</td>
              <td>{r.due_date}</td>
              <td>
                <span className={`pill ${r.status}`}>{r.status}</span>
              </td>
              <td>
                {r.status !== "paid" && (
                  <button className="tiny" onClick={() => api.setInvoiceStatus(r.id, "paid").then(load)}>
                    Mark paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Stock() {
  const [rows, setRows] = useState<Product[]>([]);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    qty: 0,
    reorder_level: 10,
    unit_cost: 0,
    category: "general",
  });

  async function load() {
    setRows(await api.products());
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.createProduct(form);
    await load();
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2>What is on the floor.</h2>
        </div>
      </header>
      <form className="create" onSubmit={onSubmit}>
        <input required placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
        <input
          type="number"
          placeholder="Reorder"
          value={form.reorder_level}
          onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
        />
        <button type="submit">Add SKU</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Qty</th>
            <th>Reorder</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={p.qty <= p.reorder_level ? "warn" : ""}>
              <td className="mono">{p.sku}</td>
              <td>{p.name}</td>
              <td>{p.qty}</td>
              <td>{p.reorder_level}</td>
              <td>
                <button className="tiny" onClick={() => api.stock(p.id, 5).then(load)}>
                  +5
                </button>
                <button className="tiny" onClick={() => api.stock(p.id, -1).then(load)}>
                  −1
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Tasks() {
  const [rows, setRows] = useState<Task[]>([]);
  const [form, setForm] = useState({ title: "", assignee: "Ops", priority: "medium", due_date: "", details: "" });

  async function load() {
    setRows(await api.tasks());
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.createTask(form);
    setForm({ ...form, title: "" });
    await load();
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Work</p>
          <h2>What still needs a human.</h2>
        </div>
      </header>
      <form className="create" onSubmit={onSubmit}>
        <input required placeholder="Task" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input placeholder="Assignee" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option>low</option>
          <option>medium</option>
          <option>high</option>
        </select>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <button type="submit">Queue it</button>
      </form>
      <ul className="task-list">
        {rows.map((t) => (
          <li key={t.id} className={t.status}>
            <div>
              <b>{t.title}</b>
              <p>
                {t.assignee} · {t.due_date || "no due date"}
              </p>
            </div>
            <span className={`pill ${t.priority}`}>{t.priority}</span>
            {t.status !== "done" && (
              <button
                className="tiny"
                onClick={() => api.updateTask(t.id, { ...t, status: "done" }).then(load)}
              >
                Done
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Inbox() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  async function load() {
    setRows(await api.inbox());
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Customers already wrote in.</h2>
        </div>
      </header>
      <div className="letters">
        {rows.map((i) => (
          <article key={i.id} className="panel letter">
            <header>
              <b>
                #{i.id} {i.subject}
              </b>
              <span className={`pill ${i.status}`}>{i.status}</span>
            </header>
            <p className="muted">
              {i.sender} · {i.email}
            </p>
            <p>{i.body}</p>
            {i.reply && <blockquote>{i.reply}</blockquote>}
            {i.status === "open" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  api.replyInbox(i.id, drafts[i.id] || "Thanks — we are on it.").then(load);
                }}
              >
                <textarea
                  placeholder="Reply…"
                  value={drafts[i.id] || ""}
                  onChange={(e) => setDrafts({ ...drafts, [i.id]: e.target.value })}
                />
                <button type="submit">Send reply</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="metric">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}
