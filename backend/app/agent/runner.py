import json
import re
from typing import Any

from sqlalchemy.orm import Session

from ..config import settings
from ..models import AgentMessage
from . import tools


SYSTEM = (
    "You are Northline, an AI business operations agent. "
    "You run CRM, invoices, inventory, tasks, and the customer inbox. "
    "Use tools for live data. Be concise, specific, and action-oriented. "
    "When you create or change records, confirm ids and next steps. "
    "Currency is USD unless the user says otherwise."
)


def run_agent(db: Session, user_message: str) -> tuple[str, list[str]]:
    used: list[str] = []
    if settings.openai_api_key:
        try:
            reply, used = _openai_loop(db, user_message)
            _store(db, user_message, reply, used)
            return reply, used
        except Exception as exc:
            reply = _local_agent(db, user_message, used)
            reply += f"\n\n(Cloud model unavailable: {exc}. Used the on-desk agent instead.)"
            _store(db, user_message, reply, used)
            return reply, used
    reply = _local_agent(db, user_message, used)
    _store(db, user_message, reply, used)
    return reply, used


def _store(db: Session, user: str, assistant: str, used: list[str]) -> None:
    db.add(AgentMessage(role="user", content=user, tools_used=""))
    db.add(AgentMessage(role="assistant", content=assistant, tools_used=",".join(used)))
    db.commit()


def _openai_loop(db: Session, user_message: str) -> tuple[str, list[str]]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    used: list[str] = []
    history = (
        db.query(AgentMessage)
        .order_by(AgentMessage.id.desc())
        .limit(16)
        .all()
    )
    history = list(reversed(history))
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM}]
    for m in history:
        if m.role in ("user", "assistant"):
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": user_message})

    for _ in range(6):
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            tools=tools.tool_specs(),
            tool_choice="auto",
        )
        choice = resp.choices[0].message
        if choice.tool_calls:
            messages.append(
                {
                    "role": "assistant",
                    "content": choice.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in choice.tool_calls
                    ],
                }
            )
            for tc in choice.tool_calls:
                name = tc.function.name
                args = json.loads(tc.function.arguments or "{}")
                result = tools.execute(db, name, args)
                used.append(name)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": tools.dump(result),
                    }
                )
            continue
        return (choice.content or "Done.").strip(), used
    return "I hit the tool-call limit. Ask me to continue with a narrower request.", used


def _call(db: Session, used: list[str], name: str, args: dict) -> Any:
    used.append(name)
    return tools.execute(db, name, args)


def _local_agent(db: Session, message: str, used: list[str]) -> str:
    text = message.strip()
    low = text.lower()

    if re.search(r"\b(brief|summary|dashboard|how are we|kpis?|daily)\b", low):
        data = _call(db, used, "get_ops_brief", {})
        return data["brief"]

    m = re.search(
        r"(?:create|add|new)\s+(?:a\s+)?(?:customer|lead)\s+(?:named\s+|called\s+)?(.+?)(?:\s+email\s+(\S+))?$",
        low,
    )
    if m:
        name = m.group(1).strip(" .")
        email = (m.group(2) or f"{name.split()[0]}@newclient.com").replace(" ", "")
        row = _call(db, used, "create_customer", {"name": name.title(), "email": email, "status": "lead"})
        return f"Created {row.get('name')} as a lead (id {row.get('id')}). Email {row.get('email')}."

    if "customer" in low or "lead" in low or "account" in low:
        query = ""
        mm = re.search(r"(?:find|search|show|who is)\s+(.+)", low)
        if mm:
            query = re.sub(r"\b(customer|lead|account)s?\b", "", mm.group(1)).strip()
        rows = _call(db, used, "search_customers", {"query": query})
        if not rows:
            return "No matching customers."
        lines = [f"- {r['name']} · {r['company']} · {r['status']} · {r['email']}" for r in rows[:8]]
        return "Accounts:\n" + "\n".join(lines)

    m = re.search(r"(?:create|draft|send|raise)\s+(?:an?\s+)?invoice(?:\s+for\s+(.+?))?(?:\s+for\s+\$?([\d,.]+))?", low)
    if "invoice" in low and re.search(r"create|draft|send|raise|new", low):
        amount_m = re.search(r"\$?\s*([\d,]+\.?\d*)", low)
        who = None
        who_m = re.search(r"for\s+([a-z0-9 .&'-]+?)(?:\s+for\s+\$|\s+\$|\s+amount|\s*$)", low)
        if who_m:
            who = who_m.group(1).strip()
            who = re.sub(r"\b(an? invoice)\b", "", who).strip()
        if not who:
            return "Tell me the customer and amount, e.g. 'create invoice for Harbor Logistics for 1500'."
        if not amount_m:
            return "Include an amount, e.g. 'create invoice for Kite Foods for 900'."
        amount = float(amount_m.group(1).replace(",", ""))
        row = _call(db, used, "create_invoice", {"customer": who, "amount": amount, "description": text})
        if row.get("error"):
            return row["error"]
        return f"Invoice {row['number']} sent to {row['customer']} for ${row['amount']:,.0f}, due {row['due_date']}."

    if re.search(r"mark .*paid|paid invoice|invoice .*paid", low):
        num = re.search(r"(nl-\d+)", low)
        if not num:
            return "Give the invoice number, e.g. mark NL-1003 paid."
        row = _call(db, used, "mark_invoice_paid", {"number": num.group(1).upper()})
        if row.get("error"):
            return row["error"]
        return f"{row['number']} is now paid (${row['amount']:,.0f})."

    if "invoice" in low or "overdue" in low or "outstanding" in low:
        status = "overdue" if "overdue" in low else None
        rows = _call(db, used, "list_invoices", {"status": status} if status else {})
        if not rows:
            return "No invoices matched."
        lines = [f"- {r['number']} {r['customer']} ${r['amount']:,.0f} · {r['status']} due {r['due_date']}" for r in rows[:10]]
        return "Invoices:\n" + "\n".join(lines)

    if re.search(r"low stock|restock|inventory|stock", low):
        if re.search(r"set|add|receive|adjust", low):
            delta_m = re.search(r"([+-]?\d+)", low)
            name_m = re.search(r"(?:for|on|sku)?\s*([a-z0-9\- ]+?)(?:\s+by|\s+to|\s*$)", low)
            if delta_m and ("add" in low or "receive" in low or "+" in low):
                row = _call(
                    db,
                    used,
                    "adjust_stock",
                    {"name": name_m.group(1) if name_m else "", "delta": int(delta_m.group(1))},
                )
            elif delta_m:
                row = _call(
                    db,
                    used,
                    "adjust_stock",
                    {"name": name_m.group(1) if name_m else "", "qty": int(delta_m.group(1))},
                )
            else:
                row = {"error": "Say how many, e.g. add 20 scanners."}
            if row.get("error"):
                lows = _call(db, used, "list_inventory", {"low_stock_only": True})
                return row["error"] + "\nLow stock: " + ", ".join(f"{p['name']} ({p['qty']})" for p in lows)
            return f"{row['name']} is now qty {row['qty']}."
        rows = _call(db, used, "list_inventory", {"low_stock_only": "low" in low or "restock" in low})
        if not rows:
            return "Inventory looks healthy."
        return "Inventory:\n" + "\n".join(
            f"- {r['sku']} {r['name']} · qty {r['qty']}" + (" (restock)" if r.get("low") else "")
            for r in rows
        )

    if re.search(r"complete task|mark task|done task|finish task", low) or (
        "done" in low and "task" in low
    ):
        title = re.sub(r".*(complete|finish|done|mark)\s+(the\s+)?task\s*", "", low).strip(" .")
        row = _call(db, used, "complete_task", {"title": title or text})
        if row.get("error"):
            return row["error"]
        return f"Closed task #{row['id']}: {row['title']}."

    if re.search(r"create|add|new", low) and "task" in low:
        title = re.sub(r".*(task)\s+(to\s+|for\s+)?", "", text, flags=re.I).strip(" .") or text
        row = _call(db, used, "create_task", {"title": title, "priority": "high" if "urgent" in low or "high" in low else "medium"})
        return f"Task #{row['id']} created: {row['title']} (assignee {row['assignee']})."

    if "task" in low:
        rows = _call(db, used, "list_tasks", {})
        if not rows:
            return "No open tasks."
        return "Open tasks:\n" + "\n".join(
            f"- #{r['id']} {r['title']} · {r['assignee']} · {r['priority']}" for r in rows
        )

    if "inbox" in low or "inquir" in low or "email" in low:
        if "reply" in low:
            id_m = re.search(r"#?(\d+)", low)
            if not id_m:
                return "Give an inquiry id, e.g. reply to inquiry 2: we can dispatch Sunday."
            reply = re.split(r":\s*", text, maxsplit=1)
            body = reply[1] if len(reply) > 1 else "Thanks — we are on it and will confirm shortly."
            row = _call(db, used, "reply_inquiry", {"inquiry_id": int(id_m.group(1)), "reply": body})
            if row.get("error"):
                return row["error"]
            return f"Replied to inquiry #{row['id']} ({row['subject']})."
        rows = _call(db, used, "list_inbox", {})
        if not rows:
            return "Inbox is clear."
        return "Open inbox:\n" + "\n".join(f"- #{r['id']} {r['sender']}: {r['subject']}" for r in rows)

    brief = _call(db, used, "get_ops_brief", {})
    return (
        "I can brief the day, raise invoices, chase overdue, restock, create tasks, or reply to inbox.\n\n"
        + brief["brief"]
    )
