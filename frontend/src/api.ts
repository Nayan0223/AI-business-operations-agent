const API = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export type Dashboard = {
  customers: number;
  open_tasks: number;
  open_inbox: number;
  paid_revenue: number;
  outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  low_stock: { id: number; sku: string; name: string; qty: number; reorder_level: number }[];
  recent_tasks: { id: number; title: string; priority: string; status: string; assignee: string }[];
  activity: { kind: string; label: string; meta: string }[];
  generated_at: string;
};

export type Customer = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
};

export type Invoice = {
  id: number;
  number: string;
  customer_id: number;
  customer_name: string;
  amount: number;
  status: string;
  due_date: string;
  description: string;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  qty: number;
  reorder_level: number;
  unit_cost: number;
  category: string;
};

export type Task = {
  id: number;
  title: string;
  details: string;
  assignee: string;
  priority: string;
  status: string;
  due_date: string;
};

export type Inquiry = {
  id: number;
  sender: string;
  email: string;
  subject: string;
  body: string;
  status: string;
  reply: string;
};

export type AgentMsg = {
  id: number;
  role: string;
  content: string;
  tools_used: string;
};

export const api = {
  dashboard: () => req<Dashboard>("/dashboard"),

  customers: (q = "") =>
    req<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCustomer: (body: Omit<Customer, "id" | "created_at">) =>
    req<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
  updateCustomer: (id: number, body: Omit<Customer, "id" | "created_at">) =>
    req<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  invoices: () => req<Invoice[]>("/invoices"),
  createInvoice: (body: { customer_id: number; amount: number; due_date: string; description: string }) =>
    req<Invoice>("/invoices", { method: "POST", body: JSON.stringify(body) }),
  setInvoiceStatus: (id: number, status: string) =>
    req<Invoice>(`/invoices/${id}/status?status=${status}`, { method: "PATCH" }),

  products: () => req<Product[]>("/products"),
  createProduct: (body: Omit<Product, "id">) =>
    req<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
  stock: (id: number, delta: number) =>
    req<Product>(`/products/${id}/stock`, { method: "PATCH", body: JSON.stringify({ delta }) }),

  tasks: () => req<Task[]>("/tasks"),
  createTask: (body: Partial<Task> & { title: string }) =>
    req<Task>("/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: number, body: Task) =>
    req<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  inbox: () => req<Inquiry[]>("/inbox"),
  createInquiry: (body: { sender: string; email: string; subject: string; body: string }) =>
    req<Inquiry>("/inbox", { method: "POST", body: JSON.stringify(body) }),
  replyInbox: (id: number, reply: string) =>
    req<Inquiry>(`/inbox/${id}/reply`, { method: "POST", body: JSON.stringify({ reply }) }),

  messages: () => req<AgentMsg[]>("/agent/messages"),
  ask: (message: string) =>
    req<{ reply: string; tools_used: string[] }>("/agent/ask", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export type AdminSettings = {
  app_name: string;
  openai_api_key_masked: string;
  openai_api_key_set: boolean;
  openai_model: string;
  database_url_masked: string;
  cors_origins: string;
};

export type DbTable = { table: string; columns: string[]; rows: Record<string, unknown>[]; total: number };

export const adminApi = {
  auth:     (pin: string) => req<{ ok: boolean }>("/admin/auth", { method: "POST", body: JSON.stringify({ pin }) }),
  settings: () => req<AdminSettings>("/admin/settings"),
  saveSettings: (body: { openai_api_key?: string; openai_model?: string; admin_pin?: string }) =>
    req<{ ok: boolean }>("/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
  tables:   () => req<{ tables: string[] }>("/admin/db/tables"),
  tableRows: (table: string, limit = 100) => req<DbTable>(`/admin/db/tables/${table}?limit=${limit}`),
  users:    () => req<{ users: { id: number; name: string; role: string; email: string }[] }>("/admin/users"),
};
