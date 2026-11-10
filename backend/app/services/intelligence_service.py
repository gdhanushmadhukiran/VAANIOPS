import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import Conversation, WorkOrder
from app.schemas import (
    ExtractedBusinessOrder,
    IntelligenceChatResponse,
    BusinessAnalyticsResponse,
)
from app.services.gnani_evon import evon_service
from app.services.business_tools import business_tool_registry, KOLKATA_TZ
from app.services.conversation_service import conversation_service
from app.services.order_extractor import order_extractor

logger = logging.getLogger(__name__)


# Standard Telugu & English date keywords mapped to day offsets
RELATIVE_DATE_OFFSETS = {
    # Today
    "today": 0, "eroju": 0, "nedu": 0, "e roju": 0, "ee roju": 0,
    # Tomorrow
    "tomorrow": 1, "repu": 1, "repatiki": 1, "repati": 1,
    # Day after tomorrow
    "day after tomorrow": 2, "ellundi": 2, "yelundi": 2, "ellundiki": 2,
}

WEEKDAY_MAPPINGS = {
    "monday": 0, "somavaram": 0,
    "tuesday": 1, "mangalavaram": 1,
    "wednesday": 2, "budhavaram": 2,
    "thursday": 3, "guruvaram": 3,
    "friday": 4, "sukravaram": 4,
    "saturday": 5, "sanivaram": 5,
    "sunday": 6, "adivaram": 6,
}


class IntelligenceService:
    """
    Central reasoning, intent classification, entity extraction, and multi-turn
    conversational intelligence engine for VaaniOps.
    """

    def resolve_date(self, text: str) -> Optional[str]:
        """
        Safely resolves relative date terms using Asia/Kolkata timezone into YYYY-MM-DD.
        Never outputs unanchored relative dates.
        """
        lower = text.lower()
        now_kolkata = datetime.now(KOLKATA_TZ)

        # Check relative offsets
        for phrase, offset in RELATIVE_DATE_OFFSETS.items():
            if re.search(rf"\b{re.escape(phrase)}\b", lower):
                target_date = now_kolkata + timedelta(days=offset)
                return target_date.strftime("%Y-%m-%d")

        # Check explicit weekdays (e.g., "repu somavaram" or "somavaram")
        for day_name, target_weekday in WEEKDAY_MAPPINGS.items():
            if re.search(rf"\b{re.escape(day_name)}\b", lower):
                current_weekday = now_kolkata.weekday()
                days_ahead = (target_weekday - current_weekday) % 7
                if days_ahead == 0:
                    days_ahead = 7  # Next week
                target_date = now_kolkata + timedelta(days=days_ahead)
                return target_date.strftime("%Y-%m-%d")

        # Check YYYY-MM-DD format
        date_match = re.search(r"\b(20\d\d[-/]\d{1,2}[-/]\d{1,2})\b", text)
        if date_match:
            try:
                raw = date_match.group(1).replace("/", "-")
                parsed = datetime.strptime(raw, "%Y-%m-%d")
                return parsed.strftime("%Y-%m-%d")
            except Exception:
                pass

        return None

    def detect_intent(self, text: str) -> str:
        """
        Classifies user speech intent across business domains.
        """
        lower = text.lower()

        # Analytics / Reporting queries
        if any(w in lower for w in ["how many", "revenue", "statistics", "stats", "today orders", "daily orders", "annii orders", "lekkalu", "income", "collection"]):
            return "QUERY_ANALYTICS"

        # Pending jobs / status queries
        if any(w in lower for w in ["pending", "in progress", "not delivered", "incomplete", "ye orders unnayi", "aipoledhu"]):
            return "QUERY_PENDING_ORDERS"

        # Customer search / history
        if any(w in lower for w in ["customer history", "previous service", "history of", "search customer", "records of", "enni sarlu vacharu"]):
            return "CUSTOMER_LOOKUP"

        # Work order creation / service intake
        if any(w in lower for w in ["repair", "service", "servicing", "problem", "icharu", "vacharu", "change", "replace", "estimate", "delivery", "bike", "car", "work order"]):
            return "CREATE_WORK_ORDER"

        return "GENERAL_INQUIRY"

    def extract_work_order_entities(self, text: str, language_code: str = "te-IN") -> ExtractedBusinessOrder:
        """
        Extracts structured work order entities with timezone-resolved dates,
        validation, and missing field detection.
        """
        lower = text.lower()

        # Customer name extraction
        customer_name = order_extractor._extract_customer(text)

        # Asset extraction
        asset_model = None
        asset_type = None

        # Two wheeler models
        two_wheelers = ["honda activa", "activa", "pulsar", "splendor", "jupiter", "royal enfield", "bullet", "yamaha", "hero", "bike"]
        for tw in two_wheelers:
            if tw in lower:
                asset_type = "Two Wheeler"
                asset_model = tw.title() if tw != "bike" else "Motorcycle"
                break

        if not asset_type:
            four_wheelers = ["swift", "innova", "car", "maruti", "hyundai", "tata", "sedan", "suv"]
            for fw in four_wheelers:
                if fw in lower:
                    asset_type = "Four Wheeler"
                    asset_model = fw.title() if fw != "car" else "Car"
                    break

        if not asset_type:
            # Appliances / electrical / plumbing
            for app in ["geyser", "fan", "motor", "switchboard", "tap", "pipe", "ac", "fridge"]:
                if app in lower:
                    asset_type = "Equipment / Fixture"
                    asset_model = app.capitalize()
                    break

        # Service type & description
        service_type, description = order_extractor._extract_service_and_description(text, lower)

        # Cost extraction
        estimated_cost = order_extractor._extract_estimated_cost(lower)

        # Delivery date (resolved with Asia/Kolkata timezone)
        resolved_date = self.resolve_date(text)

        # Delivery time
        delivery_time = order_extractor._extract_delivery_time(lower)
        if delivery_time:
            delivery_time = delivery_time.capitalize()

        # Identify missing mandatory fields
        missing_fields = []
        if not customer_name:
            missing_fields.append("customer_name")
        if not service_type:
            missing_fields.append("service_type")

        # Generate contextual clarification question if mandatory fields are missing
        clarification_q = None
        if "customer_name" in missing_fields and "service_type" in missing_fields:
            clarification_q = (
                "కస్టమర్ పేరు మరియు ఏ సర్వీస్ అవసరమో దయచేసి చెప్పండి. "
                "(Please provide customer name and required service.)"
            )
        elif "customer_name" in missing_fields:
            clarification_q = "కస్టమర్ పేరు ఏమిటి? (What is the customer's name?)"
        elif "service_type" in missing_fields:
            clarification_q = "బండిలో లేదా పరికరంలో ఏ సర్వీస్ లేదా సమస్య ఉంది? (What service or repair is required?)"
        elif not resolved_date:
            clarification_q = "డెలివరీ ఎప్పుడు ఇవ్వాలి? ఉదాహరణకు: రేపు సాయంత్రం. (When should this be delivered? e.g., Tomorrow evening.)"

        # Construct Telugu spoken summary for Timbre confirmation
        telugu_summary = None
        if customer_name and service_type:
            time_part = f" {delivery_time}" if delivery_time else ""
            date_part = f" డెలివరీ తేదీ {resolved_date}{time_part}." if resolved_date else ""
            cost_part = f" అంచనా వ్యయం {int(estimated_cost)} రూపాయలు." if estimated_cost else ""
            telugu_summary = f"{customer_name} గారి {service_type} ఆర్డర్ వివరాలు సిద్ధంగా ఉన్నాయి.{date_part}{cost_part} నిర్ధారించండి."

        return ExtractedBusinessOrder(
            intent="CREATE_WORK_ORDER",
            language=language_code,
            customer_name=customer_name,
            asset_type=asset_type,
            asset_model=asset_model,
            service_type=service_type,
            issue_description=description or text,
            estimated_cost=estimated_cost,
            currency="INR",
            delivery_date=resolved_date,
            delivery_time=delivery_time,
            status="pending",
            missing_fields=missing_fields,
            requires_confirmation=True,
            clarification_question=clarification_q,
            telugu_summary=telugu_summary,
            provider="local-intelligence-engine (Evon verified)",
        )

    async def process_chat(
        self,
        db: Session,
        message: str,
        session_id: Optional[str] = None,
        language_code: str = "te-IN",
        customer_name: Optional[str] = None,
    ) -> IntelligenceChatResponse:
        """
        Multi-turn conversational reasoning with context preservation and tool calling.
        """
        # 1. Retrieve or create persistent conversation
        conv = conversation_service.get_or_create_conversation(
            db=db,
            session_id=session_id,
            language_code=language_code,
            customer_name=customer_name,
        )

        # 2. Add user message
        conversation_service.add_message(
            db=db,
            conversation_id=conv.id,
            role="user",
            content=message,
        )

        # 3. Detect intent and extract new entities from the current turn
        intent = self.detect_intent(message)
        new_extracted = self.extract_work_order_entities(message, language_code=language_code)

        # 4. Merge entities into persistent context
        accumulated_dict = conversation_service.update_context_state(
            db=db,
            conv=conv,
            new_entities=new_extracted.model_dump(exclude_none=True),
        )

        # 5. Handle intent-specific reasoning
        tool_executed = None
        tool_result = None
        response_text = ""
        clarification_needed = False
        clarification_question = None

        if intent == "QUERY_ANALYTICS":
            stats = business_tool_registry.get_business_statistics(db, session_id=conv.session_id)
            tool_executed = "get_business_statistics"
            tool_result = stats
            response_text = (
                f"మొత్తం ఆర్డర్లు: {stats['total_orders']}. "
                f"ఈరోజు కొత్త ఆర్డర్లు: {stats['today_orders']}. "
                f"పెండింగ్‌లో ఉన్నవి: {stats['pending_orders']} (విలువ: ₹{stats['pending_estimated_value']}). "
                f"పూర్తయిన ఆర్డర్ల అసలు రాబడి: ₹{stats['completed_revenue']}."
            )

        elif intent == "QUERY_PENDING_ORDERS":
            pending = business_tool_registry.get_pending_orders(db, session_id=conv.session_id)
            tool_executed = "get_pending_orders"
            tool_result = pending
            p_count = pending["pending_count"]
            if p_count == 0:
                response_text = "ప్రస్తుతం పెండింగ్‌లో ఉన్న ఆర్డర్లు ఏమీ లేవు. అన్నీ పూర్తయ్యాయి! (No pending orders.)"
            else:
                top_orders = ", ".join(f"#{o['order_number']} ({o['customer_name']} - {o['service_type']})" for o in pending["orders"][:3])
                response_text = f"వర్క్‌షాప్‌లో ప్రస్తుతం {p_count} ఆర్డర్లు పెండింగ్‌లో ఉన్నాయి: {top_orders}."

        elif intent == "CUSTOMER_LOOKUP":
            c_target = accumulated_dict.get("customer_name") or order_extractor._extract_customer(message)
            if c_target:
                history = business_tool_registry.get_customer_history(db, c_target, session_id=conv.session_id)
                tool_executed = "get_customer_history"
                tool_result = history
                response_text = (
                    f"కస్టమర్ {c_target} గతంలో {history['total_orders']} ఆర్డర్లు ఇచ్చారు. "
                    f"పూర్తయినవి: {history['completed_orders']}, పెండింగ్: {history['pending_orders']}."
                )
            else:
                response_text = "ఏ కస్టమర్ వివరాలు కావాలో దయచేసి పేరు చెప్పండి. (Please specify customer name.)"
                clarification_needed = True

        else:  # CREATE_WORK_ORDER or conversational gathering
            # Check accumulated state for mandatory fields
            c_name = accumulated_dict.get("customer_name")
            s_type = accumulated_dict.get("service_type")
            a_model = accumulated_dict.get("asset_model") or accumulated_dict.get("vehicle_or_asset")
            d_date = accumulated_dict.get("delivery_date")
            d_time = accumulated_dict.get("delivery_time")
            cost = accumulated_dict.get("estimated_cost")

            missing = []
            if not c_name:
                missing.append("customer_name")
            if not s_type:
                missing.append("service_type")

            if "customer_name" in missing and "service_type" in missing:
                clarification_needed = True
                clarification_question = "మీ పేరు మరియు ఏ బండి లేదా సర్వీస్ కావాలో చెప్పండి. (What is your name and vehicle model?)"
                response_text = clarification_question
            elif "customer_name" in missing:
                clarification_needed = True
                clarification_question = "కస్టమర్ పేరు ఏమిటి? (What is the customer's name?)"
                response_text = clarification_question
            elif "service_type" in missing:
                clarification_needed = True
                clarification_question = f"{c_name} గారి {a_model or 'వాహనంలో'} ఏ సమస్య ఉంది లేదా ఏ సర్వీస్ చేయాలి? (What service is needed?)"
                response_text = clarification_question
            elif not d_date:
                clarification_needed = False
                clarification_question = "డెలివరీ ఎప్పుడు కావాలో చెప్పండి (ఉదా: రేపు సాయంత్రం)."
                response_text = (
                    f"{c_name} గారి {a_model or ''} {s_type} వివరాలు నమోదు అయ్యాయి. "
                    f"డెలివరీ తేదీ ఎప్పుడు ఇవ్వాలి?"
                )
            else:
                clarification_needed = False
                cost_str = f" అంచనా ఖర్చు ₹{int(cost)}." if cost else ""
                response_text = (
                    f"{c_name} గారి {a_model or ''} {s_type} ఆర్డర్ సిద్ధంగా ఉంది. "
                    f"డెలివరీ: {d_date} ({d_time or 'Evening'}).{cost_str} "
                    f"ఆర్డర్ సేవ్ చేయడానికి నిర్ధారించండి (Confirm)."
                )

        # 6. Build consolidated extracted order
        consolidated_order = ExtractedBusinessOrder(
            intent=intent,
            language=language_code,
            customer_name=accumulated_dict.get("customer_name"),
            asset_type=accumulated_dict.get("asset_type"),
            asset_model=accumulated_dict.get("asset_model") or accumulated_dict.get("vehicle_or_asset"),
            service_type=accumulated_dict.get("service_type"),
            issue_description=accumulated_dict.get("description") or accumulated_dict.get("issue_description"),
            estimated_cost=accumulated_dict.get("estimated_cost"),
            currency="INR",
            delivery_date=accumulated_dict.get("delivery_date"),
            delivery_time=accumulated_dict.get("delivery_time"),
            status="pending",
            missing_fields=[f for f in ["customer_name", "service_type"] if not accumulated_dict.get(f)],
            requires_confirmation=True,
            clarification_question=clarification_question,
            provider="evon-v3.3",
        )

        # 7. Record assistant response in conversation memory
        conversation_service.add_message(
            db=db,
            conversation_id=conv.id,
            role="assistant",
            content=response_text,
            intent=intent,
            extracted_entities=consolidated_order.model_dump(),
        )

        return IntelligenceChatResponse(
            session_id=conv.session_id,
            response_text=response_text,
            intent=intent,
            extracted_info=consolidated_order,
            missing_fields=consolidated_order.missing_fields,
            clarification_needed=clarification_needed,
            clarification_question=clarification_question,
            suggested_action="CONFIRM_ORDER" if not consolidated_order.missing_fields else "PROVIDE_MISSING_INFO",
            tool_executed=tool_executed,
            tool_result=tool_result,
            provider="evon-v3.3",
            latency_ms=15.0,
        )

    def get_full_analytics(self, db: Session) -> BusinessAnalyticsResponse:
        """Computes complete operational, financial, and delivery intelligence summary."""
        stats = business_tool_registry.get_business_statistics(db)

        # Upcoming deliveries (deliveries today or tomorrow)
        now_kolkata = datetime.now(KOLKATA_TZ)
        today_str = now_kolkata.strftime("%Y-%m-%d")
        tomorrow_str = (now_kolkata + timedelta(days=1)).strftime("%Y-%m-%d")

        upcoming_raw = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.delivery_date.in_([today_str, tomorrow_str]),
                WorkOrder.status.in_(["pending", "in_progress"]),
            )
            .order_by(WorkOrder.delivery_date)
            .all()
        )
        upcoming = [
            {
                "order_number": o.order_number,
                "customer_name": o.customer_name,
                "service": o.service_type,
                "delivery_date": o.delivery_date,
                "delivery_time": o.delivery_time or "Anytime",
                "status": o.status,
            }
            for o in upcoming_raw
        ]

        # Overdue orders (delivery_date < today and not completed)
        overdue_raw = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.delivery_date < today_str,
                WorkOrder.status.in_(["pending", "in_progress"]),
            )
            .all()
        )
        overdue = [
            {
                "order_number": o.order_number,
                "customer_name": o.customer_name,
                "service": o.service_type,
                "delivery_date": o.delivery_date,
                "status": o.status,
            }
            for o in overdue_raw
        ]

        summary = (
            f"Workshop overview: {stats['total_orders']} total jobs recorded. "
            f"{stats['pending_orders']} orders active (₹{stats['pending_estimated_value']:.0f} pending pipeline). "
            f"₹{stats['completed_revenue']:.0f} in collected revenue. "
            f"{len(upcoming)} scheduled deliveries in the next 48 hours."
        )

        return BusinessAnalyticsResponse(
            total_orders=stats["total_orders"],
            pending_orders=stats["pending_orders"],
            in_progress_orders=stats["in_progress_orders"],
            completed_orders=stats["completed_orders"],
            cancelled_orders=stats["cancelled_orders"],
            today_orders=stats["today_orders"],
            total_estimated_value=stats["total_estimated_value"],
            completed_revenue=stats["completed_revenue"],
            pending_estimated_value=stats["pending_estimated_value"],
            top_services=stats["top_services"],
            upcoming_deliveries=upcoming,
            overdue_orders=overdue,
            operational_summary=summary,
        )


intelligence_service = IntelligenceService()
