from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class WorkOrderBase(BaseModel):
    customer_name: str = Field(..., min_length=1, description="Customer or contact name")
    service_type: str = Field(..., min_length=1, description="Type of repair or service needed")
    vehicle_or_asset: Optional[str] = Field(None, description="Asset, vehicle, or equipment model")
    description: Optional[str] = Field(None, description="Detailed problem statement or notes")
    delivery_date: Optional[str] = Field(None, description="Promised completion date")
    delivery_time: Optional[str] = Field(None, description="Promised completion time")
    estimated_cost: Optional[float] = Field(None, ge=0, description="Estimated price in INR")
    status: str = Field("pending", description="Order status: pending, in_progress, completed, cancelled")
    original_transcript: Optional[str] = Field(None, description="Original raw transcript from Gnani Prisma")
    language_code: str = Field("te-IN", description="Language code used for voice transcription")


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    service_type: Optional[str] = None
    vehicle_or_asset: Optional[str] = None
    description: Optional[str] = None
    delivery_date: Optional[str] = None
    delivery_time: Optional[str] = None
    estimated_cost: Optional[float] = None
    status: Optional[str] = None


class WorkOrderResponse(WorkOrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    created_at: datetime
    updated_at: datetime


class TranscribeResponse(BaseModel):
    success: bool
    request_id: Optional[str] = None
    transcript: str
    model: str
    language_code: str


class ExtractedOrderInfo(BaseModel):
    intent: str = "create_work_order"
    customer_name: Optional[str] = None
    vehicle_or_asset: Optional[str] = None
    service_type: Optional[str] = None
    description: Optional[str] = None
    delivery_date: Optional[str] = None
    delivery_time: Optional[str] = None
    estimated_cost: Optional[float] = None
    status: str = "pending"
    requires_confirmation: bool = True


class ExtractRequest(BaseModel):
    transcript: str
    language_code: Optional[str] = "te-IN"


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    voice: Optional[str] = "Kaveri"
    language: Optional[str] = "te-IN"
    speed: Optional[float] = 1.0


class StatsResponse(BaseModel):
    total_orders: int
    pending_orders: int
    in_progress_orders: int
    completed_orders: int
    cancelled_orders: int
    today_orders: int
    recent_orders: List[WorkOrderResponse]


class GnaniServiceStatus(BaseModel):
    configured: bool
    status: str  # "AUTHENTICATION_SUCCESS", "AUTHENTICATION_FAILED", "KEY_MISSING", "CREDITS_EXHAUSTED", "SERVICE_UNAVAILABLE", "UNREACHABLE", "TIMEOUT", "ERROR", "ready"
    endpoint: str
    details: Optional[str] = None


class GnaniHealthResponse(BaseModel):
    status: str  # "KEY_MISSING", "KEY_PRESENT", "AUTHENTICATION_SUCCESS", "AUTHENTICATION_FAILED", "PARTIALLY_AUTHENTICATED", "UNREACHABLE"
    api_key_configured: bool
    key_status: str = "KEY_MISSING"  # "KEY_MISSING" or "KEY_PRESENT"
    api_key_preview: Optional[str] = None
    prisma_status: GnaniServiceStatus
    timbre_status: GnaniServiceStatus
    evon_status: Optional[GnaniServiceStatus] = None
    message: str


# =====================================================================
# Gnani Evon v3.3 Intelligence & Multi-Turn Conversation Schemas
# =====================================================================

class ExtractedBusinessOrder(BaseModel):
    intent: str = "CREATE_WORK_ORDER"
    language: str = "te-IN"
    customer_name: Optional[str] = None
    asset_type: Optional[str] = None
    asset_model: Optional[str] = None
    service_type: Optional[str] = None
    issue_description: Optional[str] = None
    estimated_cost: Optional[float] = None
    currency: str = "INR"
    delivery_date: Optional[str] = None  # Resolved ISO YYYY-MM-DD
    delivery_time: Optional[str] = None
    status: str = "pending"
    missing_fields: List[str] = []
    requires_confirmation: bool = True
    clarification_question: Optional[str] = None
    telugu_summary: Optional[str] = None
    provider: str = "evon-v3.3"


class IntelligenceChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Customer speech or query text")
    session_id: Optional[str] = Field(None, description="Unique session ID to maintain conversation context")
    language_code: Optional[str] = Field("te-IN", description="Preferred language: te-IN or en-IN")
    customer_name: Optional[str] = Field(None, description="Optional customer name if already identified")


class IntelligenceChatResponse(BaseModel):
    session_id: str
    response_text: str
    intent: str
    extracted_info: Optional[ExtractedBusinessOrder] = None
    missing_fields: List[str] = []
    clarification_needed: bool = False
    clarification_question: Optional[str] = None
    suggested_action: Optional[str] = None
    tool_executed: Optional[str] = None
    tool_result: Optional[Any] = None
    provider: str = "evon-v3.3"
    latency_ms: Optional[float] = None


class IntelligenceOrderExtractRequest(BaseModel):
    transcript: str = Field(..., min_length=1, description="Raw speech transcript")
    language_code: Optional[str] = Field("te-IN", description="Speech language: te-IN or en-IN")
    session_id: Optional[str] = Field(None, description="Optional conversation session ID")


class ActionConfirmationRequest(BaseModel):
    session_id: str
    action_type: str = "create_work_order"
    idempotency_key: str = Field(..., description="Unique client key to prevent duplicate orders")
    order_data: WorkOrderCreate


class ActionConfirmationResponse(BaseModel):
    success: bool
    order: Optional[WorkOrderResponse] = None
    message: str
    spoken_confirmation_text: Optional[str] = None
    duplicate_prevented: bool = False


class BusinessAnalyticsResponse(BaseModel):
    total_orders: int
    pending_orders: int
    in_progress_orders: int
    completed_orders: int
    cancelled_orders: int
    today_orders: int
    total_estimated_value: float
    completed_revenue: float  # Actual revenue from completed orders
    pending_estimated_value: float
    top_services: List[Dict[str, Any]]
    upcoming_deliveries: List[Dict[str, Any]]
    overdue_orders: List[Dict[str, Any]]
    operational_summary: str


class ConversationMessageSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    intent: Optional[str] = None
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    customer_name: Optional[str] = None
    language_code: str
    context_state: Dict[str, Any]
    messages: List[ConversationMessageSchema]
    created_at: datetime
    updated_at: datetime

