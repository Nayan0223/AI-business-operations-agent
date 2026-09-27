import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

const nav: { id: View; label: string; icon: string; kicker: string }[] = [
  { id: "desk",      label: "Floor",    icon: "⬡", kicker: "01" },
  { id: "agent",     label: "Agent",    icon: "◈", kicker: "02" },
  { id: "customers", label: "Accounts", icon: "◉", kicker: "03" },
  { id: "invoices",  label: "Ledger",   icon: "◪", kicker: "04" },
  { id: "stock",     label: "Stock",    icon: "▣", kicker: "05" },
  { id: "tasks",     label: "Work",     icon: "◆", kicker: "06" },
  { id: "inbox",     label: "Inbox",    icon: "◎", kicker: "07" },
];

/* ─────────────────────────────────────────── App ── */
export function App() {
  const [view, setView] = useState<View>("desk");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loadingDash, setLoadingDash] = useState(true);

  async function refreshDash() {
    setLoadingDash(true);
    try {
      setDash(await api.dashboard());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "API unavailable");
    } finally {
      setLoadingDash(false);
    }
  }

  useEffect(() => { refreshDash(); }, [view]);

  return (
    <div className="shell">
      {/* ── Rail ── */}
      <aside className="rail">
        <div className="brand">
          <div className="mark" />
          <div className="brand-text">
            <span className="eyebrow">Northline</span>
            <h1>Ops desk</h1>
          </div>
        </div>

        <span className="rail-section">Navigation</span>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              <span className="nav-kicker">{item.kicker}</span>
            </button>
          ))}
        </nav>

        <p className="rail-foot">
          <span className="status-dot" />
          Local agent · SQLite
          <br />Works without an API key
        </p>
      </aside>

      {/* ── Main ── */}
      <main>
        {error && (
          <div className="banner">
            ⚠ {error} — Start the API: <code>uvicorn app.main:app --reload --port 8000</code>
          </div>
        )}
        {view === "desk"      && (loadingDash ? <DeskSkeleton /> : dash ? <Desk dash={dash} go={setView} /> : null)}
        {view === "agent"     && <Agent />}
        {view === "customers" && <Customers />}
        {view === "invoices"  && <Invoices />}
        {view === "stock"     && <Stock />}
        {view === "tasks"     && <Tasks />}
        {view === "inbox"     && <Inbox />}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────── Skeleton ── */
function DeskSkeleton() {
  return (
    <section className="page">
      <div className="metrics" style={{ marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="metric">
            <div className="skeleton" style={{ height: 10, width: "60%", marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 28, width: "80%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 10, width: "40%" }} />
          </div>
        ))}
      </div>
      <div className="split">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="panel">
            <div className="skeleton" style={{ height: 12, width: "50%", marginBottom: 16 }} />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="skeleton" style={{ height: 10, marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Desk ── */
function Desk({ dash, go }: { dash: Dashboard; go: (v: View) => void }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const totalInv = dash.paid_revenue + dash.outstanding;
  const collectionRate = totalInv > 0 ? Math.round((dash.paid_revenue / totalInv) * 100) : 0;

  return (
    <section className="page">
      <div className="page-head">
        <div className="page-title">
          <p className="page-kicker">Operations floor</p>
          <h2>{greeting}. Here's the desk.</h2>
        </div>
        <button className="ghost" onClick={() => go("agent")}>
          ◈ Ask the agent
        </button>
      </div>

      {/* Metrics */}
      <div className="metrics">
        <Metric
          icon="💰"
          label="Collected"
          value={money(dash.paid_revenue)}
          hint={`${collectionRate}% collection rate`}
          bar={collectionRate}
          barMax={100}
        />
        <Metric
          icon="⏳"
          label="Outstanding"
          value={money(dash.outstanding)}
          hint={`${dash.overdue_count} overdue · ${money(dash.overdue_amount)}`}
          variant={dash.overdue_count > 0 ? "warn" : undefined}
        />
        <Metric
          icon="👥"
          label="Accounts"
          value={String(dash.customers)}
          hint="total in book"
        />
        <Metric
          icon="📋"
          label="Open work"
          value={String(dash.open_tasks)}
          hint={`${dash.open_inbox} unread in inbox`}
          variant={dash.open_tasks > 3 ? "warn" : undefined}
        />
      </div>

      {/* Panels */}
      <div className="split">
        {/* Low stock */}
        <article className="panel">
          <div className="panel-head">
            <h3>Restock pulse</h3>
            {dash.low_stock.length > 0 && (
              <span className="pill high">{dash.low_stock.length} items</span>
            )}
          </div>
          {dash.low_stock.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>✓ Nothing under reorder level.</p>
          ) : (
            <ul className="rows">
              {dash.low_stock.map((p) => (
                <li key={p.id}>
                  <div>
                    <b>{p.name}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.sku}</div>
                  </div>
                  <span className="pill high">
                    {p.qty} / {p.reorder_level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Live tape */}
        <article className="panel">
          <div className="panel-head">
            <h3>Live tape</h3>
            <span className="status-dot" style={{ marginRight: 0 }} />
          </div>
          <div>
            {dash.activity.map((a, i) => (
              <div key={i} className="activity-item">
                <div className={`activity-dot ${a.kind}`} />
                <div className="activity-info">
                  <div className="activity-label">{a.label}</div>
                  <div className="activity-meta">{a.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Queue */}
        <article className="panel">
          <div className="panel-head">
            <h3>Task queue</h3>
            {dash.open_tasks > 0 && (
              <span className="pill">{dash.open_tasks} open</span>
            )}
          </div>
          <ul className="rows">
            {dash.recent_tasks
              .filter((t) => t.status !== "done")
              .slice(0, 5)
              .map((t) => (
                <li key={t.id}>
                  <div>
                    <b>{t.title}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.assignee}</div>
                  </div>
                  <span className={`pill ${t.priority}`}>{t.priority}</span>
                </li>
              ))}
            {dash.recent_tasks.filter((t) => t.status !== "done").length === 0 && (
              <li><span style={{ color: "var(--muted)", fontSize: 13 }}>✓ Queue clear</span></li>
            )}
          </ul>
        </article>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  bar,
  barMax,
  variant,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  bar?: number;
  barMax?: number;
  variant?: "warn";
}) {
  return (
    <article className="metric" style={variant === "warn" ? { borderColor: "rgba(240,122,106,0.3)" } : {}}>
      <span className="metric-icon">{icon}</span>
      <p className="page-kicker">{label}</p>
      <strong style={variant === "warn" ? { color: "var(--rose)" } : {}}>{value}</strong>
      <p className="metric-hint">{hint}</p>
      {bar !== undefined && barMax !== undefined && (
        <div className="stat-bar">
          <div className="stat-bar-fill" style={{ width: `${Math.min(100, bar)}%` }} />
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────── Agent ── */
function Agent() {
  const [msgs, setMsgs] = useState<AgentMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const prompts = [
    "Give me the daily brief",
    "Show overdue invoices",
    "Create invoice for Harbor Logistics for 1500",
    "What is low in stock?",
    "List open tasks",
    "Show inbox",
  ];

  useEffect(() => {
    api.messages().then(setMsgs).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs, busy]);

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
          tools_used: Array.isArray(res.tools_used) ? res.tools_used.join(",") : res.tools_used,
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
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div className="page-title">
          <p className="page-kicker">Northline agent</p>
          <h2>Talk to the operation.</h2>
        </div>
      </div>

      <div className="chips">
        {prompts.map((p) => (
          <button key={p} onClick={() => send(p)} disabled={busy}>
            {p}
          </button>
        ))}
      </div>

      <div className="transcript" ref={scrollRef}>
        {msgs.length === 0 && (
          <div className="empty" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="empty-icon">◈</div>
            <h4>Agent ready</h4>
            <p>Ask about invoices, stock, tasks, or the daily brief.</p>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            <p>{m.content}</p>
            {m.tools_used && <small>tools · {m.tools_used}</small>}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant typing">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        )}
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
          placeholder={busy ? "Thinking…" : "Raise an invoice, restock, brief the day…"}
          disabled={busy}
          autoFocus
        />
        <button type="submit" disabled={busy || !text.trim()}>
          Send ↑
        </button>
      </form>
    </section>
  );
}

/* ─────────────────────────────────────────── Customers ── */
function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "", status: "lead", notes: "",
  });
  const [editId, setEditId] = useState<number | null>(null);

  async function load(query = q) {
    setLoading(true);
    try { setRows(await api.customers(query)); } finally { setLoading(false); }
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.updateCustomer(editId, form);
        setEditId(null);
      } else {
        await api.createCustomer(form);
      }
      setForm({ name: "", company: "", email: "", phone: "", status: "lead", notes: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: Customer) {
    setEditId(c.id);
    setForm({ name: c.name, company: c.company, email: c.email, phone: c.phone, status: c.status, notes: c.notes });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ name: "", company: "", email: "", phone: "", status: "lead", notes: "" });
  }

  return (
    <section className="page">
      <div className="page-head">
        <div className="page-title">
          <p className="page-kicker">CRM</p>
          <h2>Accounts on the book.</h2>
        </div>
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className="search"
            type="search"
            placeholder="Search name, company, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
      </div>

      {/* Form */}
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <form className="form-row" onSubmit={onSubmit}>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Name *</label>
            <input required placeholder="Priya Mehta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Company</label>
            <input placeholder="Lumen Retail" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Email *</label>
            <input required type="email" placeholder="priya@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field" style={{ minWidth: 120 }}>
            <label>Phone</label>
            <input placeholder="+1 555 000 1234" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field" style={{ minWidth: 100 }}>
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="lead">lead</option>
              <option value="active">active</option>
              <option value="churned">churned</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
            {editId && <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Saving…" : editId ? "Update" : "+ Add account"}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-count">{rows.length} accounts</span>
        </div>
        {loading ? (
          <div style={{ padding: 32 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 14, marginBottom: 12 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◉</div>
            <h4>No accounts found</h4>
            <p>Add your first customer above.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={editId === c.id ? { background: "var(--lime-bg)" } : {}}>
                  <td><b>{c.name}</b></td>
                  <td style={{ color: "var(--muted)" }}>{c.company || "—"}</td>
                  <td className="mono">{c.email}</td>
                  <td style={{ color: "var(--muted)" }}>{c.phone || "—"}</td>
                  <td><span className={`pill ${c.status}`}>{c.status}</span></td>
                  <td>
                    <button className="tiny" onClick={() => startEdit(c)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Invoices ── */
function Invoices() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: 0, amount: 0, due_date: "", description: "" });

  async function load() {
    setLoading(true);
    try {
      const [inv, cus] = await Promise.all([api.invoices(), api.customers()]);
      setRows(inv);
      setCustomers(cus);
      if (!form.customer_id && cus[0]) setForm((f) => ({ ...f, customer_id: cus[0].id }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api.createInvoice(form); await load(); } finally { setSaving(false); }
  }

  const filtered = useMemo(
    () => filterStatus ? rows.filter((r) => r.status === filterStatus) : rows,
    [rows, filterStatus]
  );

  const total = useMemo(
    () => filtered.filter((r) => r.status !== "paid" && r.status !== "void").reduce((s, r) => s + r.amount, 0),
    [filtered]
  );

  const statuses = ["", "draft", "sent", "paid", "overdue", "void"];

  return (
    <section className="page">
      <div className="page-head">
        <div className="page-title">
          <p className="page-kicker">Ledger</p>
          <h2>Open {money(total)}</h2>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {statuses.map((s) => (
            <button
              key={s || "all"}
              className={`tiny ${filterStatus === s ? "success" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Create form */}
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <form className="form-row" onSubmit={onSubmit}>
          <div className="field">
            <label>Account *</label>
            <select
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Amount *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="1500"
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Due date *</label>
            <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <input placeholder="Services rendered" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Saving…" : "+ Issue invoice"}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-count">{filtered.length} invoices</span>
        </div>
        {loading ? (
          <div style={{ padding: 32 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 14, marginBottom: 12 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◪</div>
            <h4>No invoices</h4>
            <p>Issue your first invoice above.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Account</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Due date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.number}</td>
                  <td><b>{r.customer_name}</b></td>
                  <td style={{ color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.description || "—"}
                  </td>
                  <td><b>{money(r.amount)}</b></td>
                  <td className="mono">{r.due_date}</td>
                  <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                  <td>
                    {r.status !== "paid" && r.status !== "void" && (
                      <button className="tiny success" onClick={() => api.setInvoiceStatus(r.id, "paid").then(load)}>
                        Mark paid
                      </button>
                    )}
                    {r.status !== "void" && r.status !== "paid" && (
                      <button className="tiny danger" onClick={() => api.setInvoiceStatus(r.id, "void").then(load)}>
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Stock ── */
function Stock() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [form, setForm] = useState({
    sku: "", name: "", qty: 0, reorder_level: 10, unit_cost: 0, category: "general",
  });

  async function load() {
    setLoading(true);
    try { setRows(await api.products()); } finally { setLoading(false); }
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api.createProduct(form); setForm({ sku: "", name: "", qty: 0, reorder_level: 10, unit_cost: 0, category: "general" }); await load(); }
    finally { setSaving(false); }
  }

  const displayed = filter === "low" ? rows.filter((p) => p.qty <= p.reorder_level) : rows;
  const lowCount = rows.filter((p) => p.qty <= p.reorder_level).length;

  return (
    <section className="page">
      <div className="page-head">
        <div className="page-title">
          <p className="page-kicker">Inventory</p>
          <h2>What's on the floor.</h2>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={`tiny ${filter === "all" ? "success" : ""}`} onClick={() => setFilter("all")}>All ({rows.length})</button>
          <button className={`tiny ${filter === "low" ? "success" : ""}`} onClick={() => setFilter("low")}>
            Restock ({lowCount})
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <form className="form-row" onSubmit={onSubmit}>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>SKU *</label>
            <input required placeholder="NL-PROD-01" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="field">
            <label>Name *</label>
            <input required placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ maxWidth: 100 }}>
            <label>Qty</label>
            <input type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ maxWidth: 100 }}>
            <label>Reorder at</label>
            <input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ maxWidth: 100 }}>
            <label>Unit cost</label>
            <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="general">general</option>
              <option value="hardware">hardware</option>
              <option value="software">software</option>
              <option value="consumable">consumable</option>
              <option value="kits">kits</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "…" : "+ Add SKU"}
            </button>
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-count">{displayed.length} SKUs</span>
          {lowCount > 0 && <span className="pill high">{lowCount} need restock</span>}
        </div>
        {loading ? (
          <div style={{ padding: 32 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 14, marginBottom: 12 }} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">▣</div>
            <h4>No products</h4>
            <p>Add your first SKU above.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Reorder</th>
                <th>Unit cost</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((p) => {
                const isLow = p.qty <= p.reorder_level;
                return (
                  <tr key={p.id} className={isLow ? "warn" : ""}>
                    <td className="mono">{p.sku}</td>
                    <td><b>{p.name}</b></td>
                    <td style={{ color: "var(--muted)" }}>{p.category}</td>
                    <td><b>{p.qty}</b></td>
                    <td>{p.reorder_level}</td>
                    <td>{p.unit_cost > 0 ? money(p.unit_cost) : "—"}</td>
                    <td>
                      {isLow
                        ? <span className="pill high">Low stock</span>
                        : <span className="pill done">OK</span>
                      }
                    </td>
                    <td>
                      <button className="tiny success" onClick={() => api.stock(p.id, 10).then(load)}>+10</button>
                      <button className="tiny success" onClick={() => api.stock(p.id, 5).then(load)}>+5</button>
                      <button className="tiny" onClick={() => api.stock(p.id, -1).then(load)}>−1</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Tasks ── */
function Tasks() {
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"open" | "done" | "all">("open");
  const [form, setForm] = useState({ title: "", assignee: "Ops", priority: "medium", due_date: "", details: "" });

  async function load() {
    setLoading(true);
    try { setRows(await api.tasks()); } finally { setLoading(false); }
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api.createTask(form); setForm({ ...form, title: "", details: "" }); await load(); }
    finally { setSaving(false); }
  }

  const displayed = rows.filter((t) =>
    filterStatus === "all" ? true : t.status === filterStatus
  );

  const openCount = rows.filter((t) => t.status === "open").length;
  const doneCount = rows.filter((t) => t.status === "done").length;

  return (
    <section className="page">
      <div className="page-head">
        <div className="page-title">
          <p className="page-kicker">Work queue</p>
          <h2>What still needs a human.</h2>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["open", "all", "done"] as const).map((s) => (
            <button
              key={s}
              className={`tiny ${filterStatus === s ? "success" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === "open" ? `Open (${openCount})` : s === "done" ? `Done (${doneCount})` : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <form className="form-row" onSubmit={onSubmit}>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Task *</label>
            <input required placeholder="What needs doing?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Assignee</label>
            <input placeholder="Ops" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Due date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "…" : "+ Queue it"}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 60, borderRadius: 14 }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">◆</div>
          <h4>{filterStatus === "open" ? "No open tasks" : "Nothing here"}</h4>
          <p>Add tasks above or ask the agent to create them.</p>
        </div>
      ) : (
        <ul className="task-list">
          {displayed.map((t) => (
            <li key={t.id} className={t.status}>
              <div>
                <b>{t.title}</b>
                <p>{t.assignee} · {t.due_date || "no due date"}</p>
              </div>
              <span className={`pill ${t.priority}`}>{t.priority}</span>
              {t.status !== "done" ? (
                <button
                  className="tiny success"
                  onClick={() => api.updateTask(t.id, { ...t, status: "done" }).then(load)}
                >
                  ✓ Done
                </button>
              ) : (
                <span style={{ width: 60, display: "inline-block" }} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────── Inbox ── */
function Inbox() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"open" | "replied" | "all">("open");
  const [saving, setSaving] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await api.inbox()); } finally { setLoading(false); }
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function sendReply(id: number) {
    setSaving(id);
    try {
      await api.replyInbox(id, drafts[id] || "Thanks — we're on it.");
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      await load();
    } finally {
      setSaving(null);
    }
  }

  const displayed = rows.filter((r) =>
    filterStatus === "all" ? true : r.status === filterStatus
  );

  const openCount = rows.filter((r) => r.status === "open").length;
  const repliedCount = rows.filter((r) => r.status === "replied").length;

  return (
    <section className="page">
      <div className="page-head">
        <div className="page-title">
          <p className="page-kicker">Customer inbox</p>
          <h2>Customers already wrote in.</h2>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["open", "all", "replied"] as const).map((s) => (
            <button
              key={s}
              className={`tiny ${filterStatus === s ? "success" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === "open" ? `Open (${openCount})` : s === "replied" ? `Replied (${repliedCount})` : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">◎</div>
          <h4>{filterStatus === "open" ? "Inbox is clear" : "Nothing here"}</h4>
          <p>All {filterStatus === "open" ? "open" : ""} inquiries appear here.</p>
        </div>
      ) : (
        <div className="letters">
          {displayed.map((i) => (
            <article key={i.id} className="letter">
              <header>
                <b>#{i.id} {i.subject}</b>
                <span className={`pill ${i.status}`}>{i.status}</span>
              </header>
              <p className="sender">{i.sender} · {i.email}</p>
              <p className="body">{i.body}</p>
              {i.reply && <blockquote>{i.reply}</blockquote>}
              {i.status === "open" && (
                <form onSubmit={(e) => { e.preventDefault(); sendReply(i.id); }}>
                  <textarea
                    placeholder="Type your reply…"
                    value={drafts[i.id] || ""}
                    onChange={(e) => setDrafts({ ...drafts, [i.id]: e.target.value })}
                    rows={3}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} disabled={saving === i.id}>
                    {saving === i.id ? "Sending…" : "Send reply ↑"}
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
