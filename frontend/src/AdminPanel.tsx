import { FormEvent, useEffect, useState } from "react";
import { AdminSettings, DbTable, adminApi } from "./api";

const SESSION_KEY = "nl_admin_auth";

/* ─── Top-level wrapper: gated by PIN ──────────────────────────── */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");

  if (!authed) return <PinGate onAuth={() => { sessionStorage.setItem(SESSION_KEY, "1"); setAuthed(true); }} onClose={onClose} />;
  return <AdminShell onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }} onClose={onClose} />;
}

/* ─── PIN gate ──────────────────────────────────────────────────── */
function PinGate({ onAuth, onClose }: { onAuth: () => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await adminApi.auth(pin);
      onAuth();
    } catch { setErr("Wrong PIN. Default is 1234"); }
    finally { setBusy(false); }
  }

  return (
    <div className="admin-overlay">
      <div className="admin-gate">
        <button className="admin-close-x" onClick={onClose}>✕</button>
        <div className="admin-gate-icon">🔐</div>
        <h2>Admin Access</h2>
        <p>Enter your admin PIN to continue</p>
        <form onSubmit={submit}>
          <input
            type="password"
            maxLength={20}
            placeholder="Enter PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
          />
          {err && <p className="admin-err">{err}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy || !pin}>
            {busy ? "Checking…" : "Unlock →"}
          </button>
        </form>
        <p className="admin-hint">Default PIN: 1234</p>
      </div>
    </div>
  );
}

/* ─── Admin shell ────────────────────────────────────────────────── */
type AdminTab = "settings" | "database" | "users";

function AdminShell({ onLogout, onClose }: { onLogout: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<AdminTab>("settings");

  return (
    <div className="admin-overlay">
      <div className="admin-shell">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-title">
            <span className="admin-badge">ADMIN</span>
            <h2>Control Panel</h2>
          </div>
          <div className="admin-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={onLogout}>Lock</button>
            <button className="admin-close-x" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {(["settings", "database", "users"] as AdminTab[]).map(t => (
            <button key={t} className={`admin-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "settings" ? "⚙ Settings" : t === "database" ? "🗄 Database" : "👥 Users"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="admin-content">
          {tab === "settings" && <SettingsTab />}
          {tab === "database" && <DatabaseTab />}
          {tab === "users" && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

/* ─── Settings tab ──────────────────────────────────────────────── */
function SettingsTab() {
  const [cfg, setCfg] = useState<AdminSettings | null>(null);
  const [form, setForm] = useState({ openai_api_key: "", openai_model: "", admin_pin: "" });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.settings().then(s => {
      setCfg(s);
      setForm(f => ({ ...f, openai_model: s.openai_model }));
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, string> = {};
    if (form.openai_api_key)  payload.openai_api_key = form.openai_api_key;
    if (form.openai_model)    payload.openai_model = form.openai_model;
    if (form.admin_pin)       payload.admin_pin = form.admin_pin;
    try {
      await adminApi.saveSettings(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (form.openai_api_key) setForm(f => ({ ...f, openai_api_key: "" }));
    } finally { setBusy(false); }
  }

  return (
    <div className="admin-settings">
      <div className="admin-section-title">🔑 API Keys & Configuration</div>

      {cfg && (
        <div className="admin-info-grid">
          <div className="admin-info-row">
            <span>App Name</span><strong>{cfg.app_name}</strong>
          </div>
          <div className="admin-info-row">
            <span>Database</span><strong style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{cfg.database_url_masked}</strong>
          </div>
          <div className="admin-info-row">
            <span>OpenAI Key</span>
            <strong>
              {cfg.openai_api_key_set
                ? <span className="admin-key-status ok">✓ Set ({cfg.openai_api_key_masked})</span>
                : <span className="admin-key-status miss">✗ Not set – using local agent</span>}
            </strong>
          </div>
        </div>
      )}

      <form className="admin-form" onSubmit={save}>
        <div className="admin-section-title" style={{ marginTop: 24 }}>✏️ Update Settings</div>

        <div className="field">
          <label>OpenAI API Key</label>
          <input
            type="password"
            placeholder={cfg?.openai_api_key_set ? "Leave blank to keep existing" : "sk-…"}
            value={form.openai_api_key}
            onChange={e => setForm({ ...form, openai_api_key: e.target.value })}
          />
        </div>

        <div className="field">
          <label>OpenAI Model</label>
          <select value={form.openai_model} onChange={e => setForm({ ...form, openai_model: e.target.value })}>
            <option value="gpt-4o-mini">gpt-4o-mini (fast, cheap)</option>
            <option value="gpt-4o">gpt-4o (powerful)</option>
            <option value="gpt-4-turbo">gpt-4-turbo</option>
          </select>
        </div>

        <div className="field">
          <label>New Admin PIN</label>
          <input
            type="password"
            placeholder="Leave blank to keep current"
            value={form.admin_pin}
            onChange={e => setForm({ ...form, admin_pin: e.target.value })}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "fit-content" }}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="admin-saved">✓ Saved!</span>}
      </form>
    </div>
  );
}

/* ─── Database viewer tab ────────────────────────────────────────── */
function DatabaseTab() {
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<DbTable | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminApi.tables().then(r => setTables(r.tables));
  }, []);

  async function loadTable(t: string) {
    setSelected(t);
    setLoading(true);
    try { setData(await adminApi.tableRows(t)); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-db">
      <div className="admin-db-sidebar">
        <div className="admin-section-title">Tables</div>
        {tables.map(t => (
          <button key={t} className={`admin-table-btn ${selected === t ? "active" : ""}`} onClick={() => loadTable(t)}>
            <span>◼</span> {t}
          </button>
        ))}
      </div>

      <div className="admin-db-main">
        {!selected && (
          <div className="admin-empty">
            <div style={{ fontSize: 36, opacity: 0.3 }}>🗄</div>
            <p>Select a table to view its data</p>
          </div>
        )}
        {loading && <div className="admin-empty"><p>Loading…</p></div>}
        {data && !loading && (
          <>
            <div className="admin-db-meta">
              <strong>{data.table}</strong>
              <span>{data.total.toLocaleString()} total rows</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>{data.columns.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.map((row, ri) => (
                    <tr key={ri}>
                      {data.columns.map(c => (
                        <td key={c}>{String(row[c] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Users tab ─────────────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState<{ id: number; name: string; role: string; email: string }[]>([]);

  useEffect(() => { adminApi.users().then(r => setUsers(r.users)); }, []);

  return (
    <div className="admin-users">
      <div className="admin-section-title">👥 User Accounts</div>
      <table className="admin-table">
        <thead>
          <tr><th>#</th><th>Name</th><th>Email</th><th>Role</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><span className="badge badge-active">{u.role}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 12 }}>
        Full user management (add/remove/roles) can be enabled by connecting a users table to the database.
      </p>
    </div>
  );
}
