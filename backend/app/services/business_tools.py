import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.models import WorkOrder, IntelligenceAuditLog
from app.schemas import WorkOrderCreate, WorkOrderResponse
from app.routers.orders import generate_unique_order_number

logger = logging.getLogger(__name__)

KOLKATA_TZ = timezone(timedelta(hours=5, minutes=30), name="IST")


def _log_audit(
    db: Session,
    tool_name: str,
    parameters: Dict[str, Any],
    result: Any,
    status: str = "success",
    session_id: Optional[str] = None,
):
    try:
        log_entry = IntelligenceAuditLog(
            session_id=session_id,
            tool_name=tool_name,
            parameters=json.dumps(parameters, default=str),
            result=json.dumps(result, default=str)[:2000],
            status=status,
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to write intelligence audit log: %s", e)


class BusinessToolRegistry:
    """
    Controlled registry of validated business operations executed by the intelligence layer.
    Strictly isolated from unrestricted SQL, shell commands, or arbitrary execution.
    """

    # Declarative OpenAI-compatible tool specifications for Evon v3.3
    TOOL_DEFINITIONS = [
        {
            "type": "function",
            "function": {
                "name": "create_work_order",
                "description": "Creates a new verified customer work order after explicit user confirmation.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer_name": {"type": "string", "description": "Customer name"},
                        "service_type": {"type": "string", "description": "Specific repair or service required"},
                        "vehicle_or_asset": {"type": "string", "description": "Vehicle model or equipment asset"},
                        "description": {"type": "string", "description": "Detailed notes on customer issue"},
                        "delivery_date": {"type": "string", "description": "Resolved ISO date YYYY-MM-DD"},
                        "delivery_time": {"type": "string", "description": "Time of delivery e.g. 'Evening', '11:00 AM'"},
                        "estimated_cost": {"type": "number", "description": "Estimated cost in INR"},
                        "idempotency_key": {"type": "string", "description": "Unique key to prevent duplicate creation"},
                    },
                    "required": ["customer_name", "service_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_customer",
                "description": "Searches for existing customers by name or partial string in the database.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Customer name or partial match"},
                    },
                    "required": ["query"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_customer_history",
                "description": "Retrieves past orders, service history, and vehicle records for a given customer name.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer_name": {"type": "string", "description": "Exact or partial customer name"},
                    },
                    "required": ["customer_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_work_order",
                "description": "Retrieves detailed information for an order number or ID.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_identifier": {"type": "string", "description": "Order number (e.g. VO-20261110-1234) or ID"},
                    },
                    "required": ["order_identifier"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_work_order_status",
                "description": "Updates the status of an existing work order (pending, in_progress, completed, cancelled).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_number": {"type": "string", "description": "Work order number"},
                        "new_status": {"type": "string", "enum": ["pending", "in_progress", "completed", "cancelled"]},
                    },
                    "required": ["order_number", "new_status"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_delivery_commitment",
                "description": "Updates promised delivery date and time for an existing work order.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_number": {"type": "string", "description": "Work order number"},
                        "delivery_date": {"type": "string", "description": "New delivery date YYYY-MM-DD"},
                        "delivery_time": {"type": "string", "description": "New delivery time"},
                    },
                    "required": ["order_number", "delivery_date"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_daily_orders",
                "description": "Lists work orders received or scheduled for a given date (defaults to today).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date_str": {"type": "string", "description": "Date formatted YYYY-MM-DD or 'today'"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_pending_orders",
                "description": "Lists all currently incomplete (pending or in_progress) work orders requiring attention.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_business_statistics",
                "description": "Provides accurate financial, order status, and workshop volume analytics from actual database records.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "estimate_service_cost",
                "description": "Provides standard benchmark price estimation for common workshop and service tasks.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service_type": {"type": "string", "description": "Service or repair name"},
                        "asset_model": {"type": "string", "description": "Vehicle or asset model"},
                    },
                    "required": ["service_type"],
                },
            },
        },
    ]

    # --- Tool Implementations ---

    @staticmethod
    def create_work_order(
        db: Session,
        payload: Dict[str, Any],
        session_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates work order with idempotency protection against duplicate submission."""
        customer_name = (payload.get("customer_name") or "").strip()
        service_type = (payload.get("service_type") or "").strip()

        if not customer_name:
            return {"success": False, "error": "Customer name is mandatory."}
        if not service_type:
            return {"success": False, "error": "Service type is mandatory."}

        # Check idempotency: check if identical order was created within the last 5 minutes
        existing = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.customer_name.ilike(customer_name),
                WorkOrder.service_type.ilike(service_type),
                WorkOrder.status == "pending",
            )
            .order_by(desc(WorkOrder.created_at))
            .first()
        )
        if existing and existing.created_at:
            created_dt = existing.created_at
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=timezone.utc)
            now_dt = datetime.now(timezone.utc)
            if abs((now_dt - created_dt).total_seconds()) < 300:
                return {
                    "success": True,
                    "duplicate_prevented": True,
                    "order_number": existing.order_number,
                    "message": f"Order {existing.order_number} was already confirmed recently for {customer_name}.",
                    "order": WorkOrderResponse.model_validate(existing).model_dump(mode="json"),
                }

        order_number = generate_unique_order_number(db)
        new_order = WorkOrder(
            order_number=order_number,
            customer_name=customer_name,
            service_type=service_type,
            vehicle_or_asset=payload.get("vehicle_or_asset"),
            description=payload.get("description"),
            delivery_date=payload.get("delivery_date"),
            delivery_time=payload.get("delivery_time"),
            estimated_cost=payload.get("estimated_cost"),
            status="pending",
            original_transcript=payload.get("original_transcript"),
            language_code=payload.get("language_code", "te-IN"),
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)

        result = {
            "success": True,
            "duplicate_prevented": False,
            "order_number": new_order.order_number,
            "message": f"Work order {new_order.order_number} created successfully for {customer_name}.",
            "order": WorkOrderResponse.model_validate(new_order).model_dump(mode="json"),
        }
        _log_audit(db, "create_work_order", payload, result, session_id=session_id)
        return result

    @staticmethod
    def search_customer(db: Session, query: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Searches customer names and aggregate summary."""
        q = query.strip()
        matches = (
            db.query(WorkOrder.customer_name, func.count(WorkOrder.id), func.max(WorkOrder.created_at))
            .filter(WorkOrder.customer_name.ilike(f"%{q}%"))
            .group_by(WorkOrder.customer_name)
            .limit(10)
            .all()
        )
        customers = [
            {"customer_name": name, "total_orders": count, "last_visit": last_visit.isoformat() if last_visit else None}
            for name, count, last_visit in matches
        ]
        res = {"query": q, "count": len(customers), "customers": customers}
        _log_audit(db, "search_customer", {"query": q}, res, session_id=session_id)
        return res

    @staticmethod
    def get_customer_history(db: Session, customer_name: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Fetches full past work order records for a specific customer."""
        cname = customer_name.strip()
        orders = (
            db.query(WorkOrder)
            .filter(WorkOrder.customer_name.ilike(cname))
            .order_by(desc(WorkOrder.created_at))
            .limit(20)
            .all()
        )
        history = [WorkOrderResponse.model_validate(o).model_dump(mode="json") for o in orders]
        completed = sum(1 for o in orders if o.status == "completed")
        pending = sum(1 for o in orders if o.status in {"pending", "in_progress"})
        res = {
            "customer_name": cname,
            "total_orders": len(orders),
            "completed_orders": completed,
            "pending_orders": pending,
            "history": history,
        }
        _log_audit(db, "get_customer_history", {"customer_name": cname}, res, session_id=session_id)
        return res

    @staticmethod
    def get_work_order(db: Session, order_identifier: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Retrieves single work order by number or ID."""
        ident = order_identifier.strip()
        order = db.query(WorkOrder).filter(
            or_(WorkOrder.order_number == ident, str(WorkOrder.id) == ident)
        ).first()
        if not order:
            return {"found": False, "message": f"Order '{ident}' not found."}
        res = {"found": True, "order": WorkOrderResponse.model_validate(order).model_dump(mode="json")}
        _log_audit(db, "get_work_order", {"order_identifier": ident}, res, session_id=session_id)
        return res

    @staticmethod
    def update_work_order_status(
        db: Session, order_number: str, new_status: str, session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        valid_statuses = {"pending", "in_progress", "completed", "cancelled"}
        if new_status not in valid_statuses:
            return {"success": False, "error": f"Invalid status '{new_status}'."}

        order = db.query(WorkOrder).filter(WorkOrder.order_number == order_number.strip()).first()
        if not order:
            return {"success": False, "error": f"Order {order_number} not found."}

        old_status = order.status
        order.status = new_status
        db.commit()
        db.refresh(order)

        res = {
            "success": True,
            "order_number": order.order_number,
            "old_status": old_status,
            "new_status": new_status,
            "message": f"Order {order.order_number} status updated to {new_status}.",
        }
        _log_audit(db, "update_work_order_status", {"order_number": order_number, "new_status": new_status}, res, session_id=session_id)
        return res

    @staticmethod
    def update_delivery_commitment(
        db: Session, order_number: str, delivery_date: str, delivery_time: Optional[str] = None, session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        order = db.query(WorkOrder).filter(WorkOrder.order_number == order_number.strip()).first()
        if not order:
            return {"success": False, "error": f"Order {order_number} not found."}

        order.delivery_date = delivery_date.strip()
        if delivery_time:
            order.delivery_time = delivery_time.strip()
        db.commit()
        db.refresh(order)

        res = {
            "success": True,
            "order_number": order.order_number,
            "delivery_date": order.delivery_date,
            "delivery_time": order.delivery_time,
            "message": f"Order {order.order_number} delivery updated to {delivery_date} ({order.delivery_time or 'Anytime'}).",
        }
        _log_audit(db, "update_delivery_commitment", {"order_number": order_number, "delivery_date": delivery_date}, res, session_id=session_id)
        return res

    @staticmethod
    def get_daily_orders(db: Session, date_str: Optional[str] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        now_kolkata = datetime.now(KOLKATA_TZ)
        target_date = now_kolkata.strftime("%Y-%m-%d") if not date_str or date_str == "today" else date_str

        # Filter orders where delivery_date is target_date or created today
        orders = (
            db.query(WorkOrder)
            .filter(
                or_(
                    WorkOrder.delivery_date == target_date,
                    func.date(WorkOrder.created_at) == target_date,
                )
            )
            .order_by(desc(WorkOrder.created_at))
            .all()
        )
        res = {
            "date": target_date,
            "total_orders": len(orders),
            "orders": [WorkOrderResponse.model_validate(o).model_dump(mode="json") for o in orders],
        }
        _log_audit(db, "get_daily_orders", {"date_str": target_date}, res, session_id=session_id)
        return res

    @staticmethod
    def get_pending_orders(db: Session, session_id: Optional[str] = None) -> Dict[str, Any]:
        orders = (
            db.query(WorkOrder)
            .filter(WorkOrder.status.in_(["pending", "in_progress"]))
            .order_by(WorkOrder.created_at)
            .all()
        )
        res = {
            "pending_count": len(orders),
            "orders": [WorkOrderResponse.model_validate(o).model_dump(mode="json") for o in orders],
        }
        _log_audit(db, "get_pending_orders", {}, res, session_id=session_id)
        return res

    @staticmethod
    def get_business_statistics(db: Session, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Provides genuine metrics strictly from SQLite database records."""
        total = db.query(WorkOrder).count()
        pending = db.query(WorkOrder).filter(WorkOrder.status == "pending").count()
        in_progress = db.query(WorkOrder).filter(WorkOrder.status == "in_progress").count()
        completed = db.query(WorkOrder).filter(WorkOrder.status == "completed").count()
        cancelled = db.query(WorkOrder).filter(WorkOrder.status == "cancelled").count()

        # Financial values: distinguish estimated total vs actual completed revenue
        completed_orders = db.query(WorkOrder).filter(WorkOrder.status == "completed").all()
        completed_revenue = sum(o.estimated_cost or 0.0 for o in completed_orders)

        pending_orders = db.query(WorkOrder).filter(WorkOrder.status.in_(["pending", "in_progress"])).all()
        pending_val = sum(o.estimated_cost or 0.0 for o in pending_orders)

        all_orders = db.query(WorkOrder).all()
        total_estimated_val = sum(o.estimated_cost or 0.0 for o in all_orders)

        # Top services
        top_services_raw = (
            db.query(WorkOrder.service_type, func.count(WorkOrder.id).label("cnt"))
            .group_by(WorkOrder.service_type)
            .order_by(desc("cnt"))
            .limit(5)
            .all()
        )
        top_services = [{"service": s, "count": c} for s, c in top_services_raw]

        now_str = datetime.now(KOLKATA_TZ).strftime("%Y-%m-%d")
        today_cnt = (
            db.query(WorkOrder)
            .filter(func.date(WorkOrder.created_at) == now_str)
            .count()
        )

        res = {
            "total_orders": total,
            "pending_orders": pending,
            "in_progress_orders": in_progress,
            "completed_orders": completed,
            "cancelled_orders": cancelled,
            "today_orders": today_cnt,
            "total_estimated_value": round(total_estimated_val, 2),
            "completed_revenue": round(completed_revenue, 2),  # Actual revenue from delivered work
            "pending_estimated_value": round(pending_val, 2),
            "top_services": top_services,
        }
        _log_audit(db, "get_business_statistics", {}, res, session_id=session_id)
        return res

    @staticmethod
    def estimate_service_cost(service_type: str, asset_model: Optional[str] = None) -> Dict[str, Any]:
        """Provides benchmark pricing matrix for workshop repairs."""
        st = service_type.lower()
        if "brake" in st:
            estimate, est_time = 1500.0, "2-3 hours"
        elif "oil" in st:
            estimate, est_time = 850.0, "1 hour"
        elif "clutch" in st:
            estimate, est_time = 2200.0, "4-5 hours"
        elif "chain" in st:
            estimate, est_time = 650.0, "1-2 hours"
        elif "puncture" in st or "tyre" in st:
            estimate, est_time = 250.0, "30 minutes"
        elif "battery" in st:
            estimate, est_time = 1800.0, "1-2 hours"
        elif "wiring" in st or "electric" in st:
            estimate, est_time = 750.0, "2-4 hours"
        elif "pipe" in st or "leak" in st:
            estimate, est_time = 600.0, "1-2 hours"
        elif "motor" in st:
            estimate, est_time = 2800.0, "1-2 days"
        else:
            estimate, est_time = 500.0, "1-2 hours"

        return {
            "service_type": service_type,
            "asset_model": asset_model,
            "estimated_cost": estimate,
            "currency": "INR",
            "estimated_duration": est_time,
            "disclaimer": "Standard benchmark estimate. Final invoice may vary based on spare parts.",
        }

    @classmethod
    def execute_tool(cls, db: Session, tool_name: str, arguments: Dict[str, Any], session_id: Optional[str] = None) -> Any:
        """Dynamically routes tool call by validated name."""
        tool_map = {
            "create_work_order": lambda: cls.create_work_order(db, arguments, session_id=session_id),
            "search_customer": lambda: cls.search_customer(db, arguments.get("query", ""), session_id=session_id),
            "get_customer_history": lambda: cls.get_customer_history(db, arguments.get("customer_name", ""), session_id=session_id),
            "get_work_order": lambda: cls.get_work_order(db, arguments.get("order_identifier", ""), session_id=session_id),
            "update_work_order_status": lambda: cls.update_work_order_status(db, arguments.get("order_number", ""), arguments.get("new_status", ""), session_id=session_id),
            "update_delivery_commitment": lambda: cls.update_delivery_commitment(db, arguments.get("order_number", ""), arguments.get("delivery_date", ""), arguments.get("delivery_time"), session_id=session_id),
            "get_daily_orders": lambda: cls.get_daily_orders(db, arguments.get("date_str"), session_id=session_id),
            "get_pending_orders": lambda: cls.get_pending_orders(db, session_id=session_id),
            "get_business_statistics": lambda: cls.get_business_statistics(db, session_id=session_id),
            "estimate_service_cost": lambda: cls.estimate_service_cost(arguments.get("service_type", ""), arguments.get("asset_model")),
        }
        if tool_name not in tool_map:
            raise ValueError(f"Unauthorized or unknown tool: {tool_name}")
        return tool_map[tool_name]()


business_tool_registry = BusinessToolRegistry()
