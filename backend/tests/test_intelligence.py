import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import WorkOrder, Conversation
from app.services.intelligence_service import intelligence_service, KOLKATA_TZ
from app.services.business_tools import business_tool_registry
from app.services.conversation_service import conversation_service


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_relative_date_resolution():
    now_kolkata = datetime.now(KOLKATA_TZ)
    tomorrow_expected = (now_kolkata + timedelta(days=1)).strftime("%Y-%m-%d")
    today_expected = now_kolkata.strftime("%Y-%m-%d")

    # Telugu 'repu'
    assert intelligence_service.resolve_date("Repu evening delivery") == tomorrow_expected
    # English 'tomorrow'
    assert intelligence_service.resolve_date("Deliver by tomorrow morning") == tomorrow_expected
    # Telugu 'eroju'
    assert intelligence_service.resolve_date("Eroju delivery kavali") == today_expected


def test_telugu_dominant_workshop_full_extraction():
    transcript = (
        "Ravi garu Honda Activa brake problem tho vacharu. "
        "Brake pads change cheyyali. Repu evening delivery. Estimate 1500 rupees."
    )
    result = intelligence_service.extract_work_order_entities(transcript, language_code="te-IN")

    assert result.customer_name == "Ravi"
    assert result.asset_model == "Honda Activa"
    assert result.asset_type == "Two Wheeler"
    assert "Brake pad" in result.service_type
    assert result.estimated_cost == 1500.0
    assert result.currency == "INR"
    assert result.delivery_time == "Evening"
    assert result.delivery_date is not None
    assert result.missing_fields == []
    assert result.requires_confirmation is True


def test_missing_fields_detection_and_clarification():
    # Only service mentioned, no customer name
    transcript = "Na bike servicing cheyyali."
    result = intelligence_service.extract_work_order_entities(transcript)

    assert "customer_name" in result.missing_fields
    assert result.clarification_question is not None
    assert "కస్టమర్ పేరు" in result.clarification_question or "Customer" in result.clarification_question


@pytest.mark.asyncio
async def test_multi_turn_context_retention(db_session: Session):
    session_id = f"test_session_{datetime.now().timestamp()}"

    # Turn 1: Service intent without customer name
    r1 = await intelligence_service.process_chat(
        db=db_session,
        message="Na bike servicing cheyyali.",
        session_id=session_id,
    )
    assert r1.clarification_needed is True
    assert "customer_name" in r1.missing_fields

    # Turn 2: Provide customer name and model
    r2 = await intelligence_service.process_chat(
        db=db_session,
        message="Ravi, Honda Activa.",
        session_id=session_id,
    )
    # Context must now hold Ravi and Honda Activa
    assert r2.extracted_info.customer_name == "Ravi"
    assert r2.extracted_info.asset_model == "Honda Activa"

    # Turn 3: Specify problem
    r3 = await intelligence_service.process_chat(
        db=db_session,
        message="Brake pads change cheyyali.",
        session_id=session_id,
    )
    assert "Brake pad" in r3.extracted_info.service_type

    # Turn 4: Cost and delivery
    r4 = await intelligence_service.process_chat(
        db=db_session,
        message="1500 rupees estimate. Repu evening delivery.",
        session_id=session_id,
    )
    assert r4.extracted_info.customer_name == "Ravi"
    assert r4.extracted_info.estimated_cost == 1500.0
    assert r4.extracted_info.delivery_date is not None
    assert r4.missing_fields == []
    assert r4.suggested_action == "CONFIRM_ORDER"


def test_duplicate_order_prevention(db_session: Session):
    unique_customer = f"Customer_{datetime.now().timestamp()}"
    payload = {
        "customer_name": unique_customer,
        "service_type": "Oil change & general service",
        "vehicle_or_asset": "Pulsar 150",
        "estimated_cost": 850.0,
        "delivery_date": "2026-11-12",
        "delivery_time": "Evening",
    }

    # First creation succeeds
    res1 = business_tool_registry.create_work_order(db=db_session, payload=payload)
    assert res1["success"] is True
    assert res1["duplicate_prevented"] is False

    # Second creation with identical payload within 5 minutes is idempotently guarded
    res2 = business_tool_registry.create_work_order(db=db_session, payload=payload)
    assert res2["success"] is True
    assert res2["duplicate_prevented"] is True
    assert res2["order_number"] == res1["order_number"]


def test_business_statistics_revenue_distinction(db_session: Session):
    stats = business_tool_registry.get_business_statistics(db=db_session)
    assert "total_orders" in stats
    assert "completed_revenue" in stats
    assert "total_estimated_value" in stats
    # Completed revenue must be numeric and not conflated with total estimated value
    assert isinstance(stats["completed_revenue"], (int, float))
    assert isinstance(stats["total_estimated_value"], (int, float))


def test_intelligence_api_endpoints(client):
    # Test /api/intelligence/extract-order
    res = client.post(
        "/api/intelligence/extract-order",
        json={"transcript": "Ravi garu bike repair kosam icharu. Repu evening delivery."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["customer_name"] == "Ravi"
    assert data["delivery_date"] is not None

    # Test /api/intelligence/status
    res_status = client.get("/api/intelligence/status")
    assert res_status.status_code == 200
    assert "status" in res_status.json()

    # Test /api/intelligence/analytics
    res_analytics = client.get("/api/intelligence/analytics")
    assert res_analytics.status_code == 200
    assert "operational_summary" in res_analytics.json()
