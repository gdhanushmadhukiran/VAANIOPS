import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    IntelligenceChatRequest,
    IntelligenceChatResponse,
    IntelligenceOrderExtractRequest,
    ExtractedBusinessOrder,
    ActionConfirmationRequest,
    ActionConfirmationResponse,
    BusinessAnalyticsResponse,
    GnaniServiceStatus,
)
from app.services.intelligence_service import intelligence_service
from app.services.business_tools import business_tool_registry
from app.services.gnani_evon import evon_service
from app.services.gnani_timbre import timbre_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.post("/chat", response_model=IntelligenceChatResponse)
async def chat_with_intelligence(request: IntelligenceChatRequest, db: Session = Depends(get_db)):
    """
    Conversational business reasoning engine.
    Maintains multi-turn context, resolves intents, identifies missing fields,
    and executes authorized database operations.
    """
    response = await intelligence_service.process_chat(
        db=db,
        message=request.message,
        session_id=request.session_id,
        language_code=request.language_code or "te-IN",
        customer_name=request.customer_name,
    )
    return response


@router.post("/extract-order", response_model=ExtractedBusinessOrder)
async def extract_work_order(request: IntelligenceOrderExtractRequest):
    """
    Intelligent entity extraction converting natural speech into structured work orders.
    Resolves relative dates via Asia/Kolkata timezone and detects missing fields.
    """
    extracted = intelligence_service.extract_work_order_entities(
        text=request.transcript,
        language_code=request.language_code or "te-IN",
    )
    return extracted


@router.post("/confirm-action", response_model=ActionConfirmationResponse)
async def confirm_action(request: ActionConfirmationRequest, db: Session = Depends(get_db)):
    """
    Idempotent execution of validated business actions (e.g. order creation)
    following explicit user confirmation. Prevents duplicate order creation.
    """
    if request.action_type != "create_work_order":
        raise HTTPException(status_code=400, detail=f"Unsupported action type: {request.action_type}")

    payload = request.order_data.model_dump()
    result = business_tool_registry.create_work_order(
        db=db,
        payload=payload,
        session_id=request.session_id,
        idempotency_key=request.idempotency_key,
    )

    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Failed to create work order."))

    # Generate spoken Telugu confirmation text for Timbre
    order_data = result.get("order")
    cname = order_data.get("customer_name") if order_data else payload.get("customer_name")
    onum = result.get("order_number")
    spoken_text = f"{cname} గారి వర్క్ ఆర్డర్ {onum} విజయవంతంగా క్రియేట్ చేయబడింది."

    return ActionConfirmationResponse(
        success=True,
        order=order_data,
        message=result.get("message", "Order confirmed successfully."),
        spoken_confirmation_text=spoken_text,
        duplicate_prevented=result.get("duplicate_prevented", False),
    )


@router.get("/status")
async def get_evon_status():
    """
    Returns real-time diagnostic status of the Gnani Evon v3.3 intelligence engine.
    """
    health_data = await evon_service.check_health()
    return health_data


@router.get("/analytics", response_model=BusinessAnalyticsResponse)
def get_business_analytics(db: Session = Depends(get_db)):
    """
    Retrieves deep business intelligence (financial, pending jobs, upcoming deliveries, top services)
    derived strictly from database records.
    """
    analytics = intelligence_service.get_full_analytics(db)
    return analytics

