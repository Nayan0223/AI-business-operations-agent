from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CustomerIn(BaseModel):
    name: str
    company: str = ""
    email: EmailStr
    phone: str = ""
    status: str = "lead"
    notes: str = ""


class CustomerOut(CustomerIn):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceItemIn(BaseModel):
    description: str
    qty: int = 1
    unit_price: float


class InvoiceIn(BaseModel):
    customer_id: int
    amount: float | None = None
    status: str = "sent"
    due_date: str
    description: str = ""
    items: list[InvoiceItemIn] = Field(default_factory=list)


class InvoiceItemOut(InvoiceItemIn):
    id: int

    model_config = {"from_attributes": True}


class InvoiceOut(BaseModel):
    id: int
    number: str
    customer_id: int
    customer_name: str = ""
    amount: float
    status: str
    due_date: str
    description: str
    created_at: datetime
    items: list[InvoiceItemOut] = []

    model_config = {"from_attributes": True}


class ProductIn(BaseModel):
    sku: str
    name: str
    qty: int = 0
    reorder_level: int = 10
    unit_cost: float = 0
    category: str = "general"


class ProductOut(ProductIn):
    id: int

    model_config = {"from_attributes": True}


class StockPatch(BaseModel):
    qty: int | None = None
    delta: int | None = None


class TaskIn(BaseModel):
    title: str
    details: str = ""
    assignee: str = "Ops"
    priority: str = "medium"
    status: str = "open"
    due_date: str = ""


class TaskOut(TaskIn):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class InquiryIn(BaseModel):
    sender: str
    email: EmailStr
    subject: str
    body: str


class InquiryOut(InquiryIn):
    id: int
    status: str
    reply: str
    created_at: datetime

    model_config = {"from_attributes": True}


class InquiryReply(BaseModel):
    reply: str


class AgentAsk(BaseModel):
    message: str


class AgentMessageOut(BaseModel):
    id: int
    role: str
    content: str
    tools_used: str
    created_at: datetime

    model_config = {"from_attributes": True}
