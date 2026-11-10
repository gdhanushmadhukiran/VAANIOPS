import random
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import WorkOrder
from app.schemas import WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse

router = APIRouter(prefix="/orders", tags=["orders"])


def generate_unique_order_number(db: Session) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    for _ in range(10):
        # 4 digit random sequence
        suffix = f"{random.randint(1000, 9999)}"
        candidate = f"VO-{today_str}-{suffix}"
        existing = db.query(WorkOrder).filter(WorkOrder.order_number == candidate).first()
        if not existing:
            return candidate
    # Fallback timestamp microsecond
    return f"VO-{today_str}-{datetime.now(timezone.utc).microsecond:06d}"


@router.post("", response_model=WorkOrderResponse, status_code=201)
def create_work_order(order_in: WorkOrderCreate, db: Session = Depends(get_db)):
    """
    Creates a validated work order and saves it to the SQLite database.
    """
    if not order_in.customer_name or not order_in.customer_name.strip():
        raise HTTPException(status_code=422, detail="Customer name is required to confirm work order.")

    if not order_in.service_type or not order_in.service_type.strip():
        raise HTTPException(status_code=422, detail="Service type is required.")

    valid_statuses = {"pending", "in_progress", "completed", "cancelled"}
    if order_in.status not in valid_statuses:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{order_in.status}'. Valid statuses: {', '.join(valid_statuses)}",
        )

    order_number = generate_unique_order_number(db)

    db_order = WorkOrder(
        order_number=order_number,
        customer_name=order_in.customer_name.strip(),
        service_type=order_in.service_type.strip(),
        vehicle_or_asset=order_in.vehicle_or_asset.strip() if order_in.vehicle_or_asset else None,
        description=order_in.description.strip() if order_in.description else None,
        delivery_date=order_in.delivery_date.strip() if order_in.delivery_date else None,
        delivery_time=order_in.delivery_time.strip() if order_in.delivery_time else None,
        estimated_cost=order_in.estimated_cost,
        status=order_in.status,
        original_transcript=order_in.original_transcript,
        language_code=order_in.language_code,
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("", response_model=List[WorkOrderResponse])
def list_work_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    q: Optional[str] = Query(None, description="Search query across customer, asset, service, order_number"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Retrieves work orders with optional filtering and search.
    """
    query = db.query(WorkOrder)

    if status and status.strip():
        query = query.filter(WorkOrder.status == status.strip())

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                WorkOrder.order_number.ilike(search_term),
                WorkOrder.customer_name.ilike(search_term),
                WorkOrder.service_type.ilike(search_term),
                WorkOrder.vehicle_or_asset.ilike(search_term),
            )
        )

    orders = query.order_by(WorkOrder.created_at.desc()).offset(offset).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=WorkOrderResponse)
def get_work_order(order_id: int, db: Session = Depends(get_db)):
    """
    Retrieves a single work order by ID.
    """
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Work order with ID {order_id} not found.")
    return order


@router.patch("/{order_id}", response_model=WorkOrderResponse)
def update_work_order(order_id: int, update_in: WorkOrderUpdate, db: Session = Depends(get_db)):
    """
    Updates status or fields of an existing work order.
    """
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Work order with ID {order_id} not found.")

    update_data = update_in.model_dump(exclude_unset=True)

    if "status" in update_data:
        valid_statuses = {"pending", "in_progress", "completed", "cancelled"}
        if update_data["status"] not in valid_statuses:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status '{update_data['status']}'. Valid statuses: {', '.join(valid_statuses)}",
            )

    for field, value in update_data.items():
        setattr(order, field, value)

    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order

