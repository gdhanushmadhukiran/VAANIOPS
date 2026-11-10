from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(150), nullable=False, index=True)
    service_type = Column(String(200), nullable=False)
    vehicle_or_asset = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    delivery_date = Column(String(50), nullable=True)
    delivery_time = Column(String(50), nullable=True)
    estimated_cost = Column(Float, nullable=True)
    status = Column(String(50), default="pending", nullable=False, index=True)
    original_transcript = Column(Text, nullable=True)
    language_code = Column(String(20), default="te-IN", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    customer_name = Column(String(150), nullable=True, index=True)
    language_code = Column(String(20), default="te-IN", nullable=False)
    context_state = Column(Text, default="{}", nullable=False)  # JSON serialized dict
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, index=True, nullable=False)
    role = Column(String(30), nullable=False)  # 'user', 'assistant', 'system', 'tool'
    content = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)
    extracted_entities = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class IntelligenceAuditLog(Base):
    __tablename__ = "intelligence_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    tool_name = Column(String(100), nullable=False)
    parameters = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    status = Column(String(50), default="success", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


