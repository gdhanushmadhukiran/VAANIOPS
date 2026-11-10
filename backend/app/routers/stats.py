from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import WorkOrder
from app.schemas import StatsResponse, WorkOrderResponse

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns aggregated dashboard metrics and recent orders.
    """
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)

    total_orders = db.query(WorkOrder).count()
    pending_orders = db.query(WorkOrder).filter(WorkOrder.status == "pending").count()
    in_progress_orders = db.query(WorkOrder).filter(WorkOrder.status == "in_progress").count()
    completed_orders = db.query(WorkOrder).filter(WorkOrder.status == "completed").count()
    cancelled_orders = db.query(WorkOrder).filter(WorkOrder.status == "cancelled").count()

    today_orders = db.query(WorkOrder).filter(WorkOrder.created_at >= today_start).count()

    recent = (
        db.query(WorkOrder)
        .order_by(WorkOrder.created_at.desc())
        .limit(5)
        .all()
    )

    return StatsResponse(
        total_orders=total_orders,
        pending_orders=pending_orders,
        in_progress_orders=in_progress_orders,
        completed_orders=completed_orders,
        cancelled_orders=cancelled_orders,
        today_orders=today_orders,
        recent_orders=[WorkOrderResponse.model_validate(o) for o in recent],
    )

