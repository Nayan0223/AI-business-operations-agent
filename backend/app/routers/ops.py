from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..services import compute_amount, invoice_number

router = APIRouter()


@router.get("/customers", response_model=list[schemas.CustomerOut])
def list_customers(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Customer).order_by(models.Customer.id.desc())
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Customer.name.ilike(like),
                models.Customer.company.ilike(like),
                models.Customer.email.ilike(like),
            )
        )
    return query.all()


@router.post("/customers", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerIn, db: Session = Depends(get_db)):
    row = models.Customer(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, payload: schemas.CustomerIn, db: Session = Depends(get_db)):
    row = db.get(models.Customer, customer_id)
    if not row:
        raise HTTPException(404, "Customer not found")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.get("/invoices", response_model=list[schemas.InvoiceOut])
def list_invoices(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Invoice).order_by(models.Invoice.id.desc())
    if status:
        q = q.filter(models.Invoice.status == status)
    out = []
    for inv in q.all():
        customer = db.get(models.Customer, inv.customer_id)
        data = schemas.InvoiceOut.model_validate(inv)
        data.customer_name = customer.name if customer else ""
        data.items = [schemas.InvoiceItemOut.model_validate(i) for i in inv.items]
        out.append(data)
    return out


@router.post("/invoices", response_model=schemas.InvoiceOut)
def create_invoice(payload: schemas.InvoiceIn, db: Session = Depends(get_db)):
    customer = db.get(models.Customer, payload.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    items = payload.items or [
        schemas.InvoiceItemIn(description=payload.description or "Services", qty=1, unit_price=payload.amount or 0)
    ]
    amount = payload.amount if payload.amount is not None else compute_amount(items)
    inv = models.Invoice(
        number=invoice_number(db),
        customer_id=payload.customer_id,
        amount=amount,
        status=payload.status,
        due_date=payload.due_date,
        description=payload.description,
    )
    db.add(inv)
    db.flush()
    for item in items:
        db.add(models.InvoiceItem(invoice_id=inv.id, **item.model_dump()))
    db.commit()
    db.refresh(inv)
    data = schemas.InvoiceOut.model_validate(inv)
    data.customer_name = customer.name
    data.items = [schemas.InvoiceItemOut.model_validate(i) for i in inv.items]
    return data


@router.patch("/invoices/{invoice_id}/status", response_model=schemas.InvoiceOut)
def set_invoice_status(invoice_id: int, status: str, db: Session = Depends(get_db)):
    inv = db.get(models.Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if status not in {"draft", "sent", "paid", "overdue", "void"}:
        raise HTTPException(400, "Invalid status")
    inv.status = status
    db.commit()
    db.refresh(inv)
    customer = db.get(models.Customer, inv.customer_id)
    data = schemas.InvoiceOut.model_validate(inv)
    data.customer_name = customer.name if customer else ""
    return data


@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).order_by(models.Product.name).all()


@router.post("/products", response_model=schemas.ProductOut)
def create_product(payload: schemas.ProductIn, db: Session = Depends(get_db)):
    row = models.Product(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/products/{product_id}/stock", response_model=schemas.ProductOut)
def patch_stock(product_id: int, payload: schemas.StockPatch, db: Session = Depends(get_db)):
    row = db.get(models.Product, product_id)
    if not row:
        raise HTTPException(404, "Product not found")
    if payload.qty is not None:
        row.qty = payload.qty
    elif payload.delta is not None:
        row.qty = max(0, row.qty + payload.delta)
    db.commit()
    db.refresh(row)
    return row


@router.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(models.Task).order_by(models.Task.id.desc()).all()


@router.post("/tasks", response_model=schemas.TaskOut)
def create_task(payload: schemas.TaskIn, db: Session = Depends(get_db)):
    row = models.Task(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskIn, db: Session = Depends(get_db)):
    row = db.get(models.Task, task_id)
    if not row:
        raise HTTPException(404, "Task not found")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.get("/inbox", response_model=list[schemas.InquiryOut])
def list_inbox(db: Session = Depends(get_db)):
    return db.query(models.Inquiry).order_by(models.Inquiry.id.desc()).all()


@router.post("/inbox", response_model=schemas.InquiryOut)
def create_inquiry(payload: schemas.InquiryIn, db: Session = Depends(get_db)):
    row = models.Inquiry(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/inbox/{inquiry_id}/reply", response_model=schemas.InquiryOut)
def reply_inquiry(inquiry_id: int, payload: schemas.InquiryReply, db: Session = Depends(get_db)):
    row = db.get(models.Inquiry, inquiry_id)
    if not row:
        raise HTTPException(404, "Inquiry not found")
    row.reply = payload.reply
    row.status = "replied"
    db.commit()
    db.refresh(row)
    return row
