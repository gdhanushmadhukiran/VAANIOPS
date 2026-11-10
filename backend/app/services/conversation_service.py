import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import Conversation, ConversationMessage

logger = logging.getLogger(__name__)


class ConversationService:
    """
    Manages persistent multi-turn conversational context in SQLite.
    Guarantees session isolation and context state accumulation across speech turns.
    """

    @staticmethod
    def get_or_create_conversation(
        db: Session,
        session_id: Optional[str] = None,
        language_code: str = "te-IN",
        customer_name: Optional[str] = None,
    ) -> Conversation:
        if not session_id:
            session_id = f"sess_{uuid.uuid4().hex[:12]}"

        conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
        if not conv:
            conv = Conversation(
                session_id=session_id,
                customer_name=customer_name,
                language_code=language_code,
                context_state="{}",
                is_active=1,
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)
        else:
            if customer_name and not conv.customer_name:
                conv.customer_name = customer_name
                db.commit()
                db.refresh(conv)
        return conv

    @staticmethod
    def add_message(
        db: Session,
        conversation_id: int,
        role: str,
        content: str,
        intent: Optional[str] = None,
        extracted_entities: Optional[Dict[str, Any]] = None,
    ) -> ConversationMessage:
        msg = ConversationMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            intent=intent,
            extracted_entities=json.dumps(extracted_entities, default=str) if extracted_entities else None,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg

    @staticmethod
    def get_conversation_messages(db: Session, conversation_id: int, limit: int = 50) -> List[ConversationMessage]:
        return (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id == conversation_id)
            .order_by(ConversationMessage.created_at)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_context_state(conv: Conversation) -> Dict[str, Any]:
        try:
            return json.loads(conv.context_state or "{}")
        except Exception:
            return {}

    @staticmethod
    def update_context_state(db: Session, conv: Conversation, new_entities: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merges new extracted non-null entities into the persistent conversation state.
        Preserves previously extracted fields.
        """
        current = ConversationService.get_context_state(conv)
        for k, v in new_entities.items():
            if v is not None and v != "":
                current[k] = v

        conv.context_state = json.dumps(current, default=str)
        conv.updated_at = datetime.now(timezone.utc)
        if current.get("customer_name") and not conv.customer_name:
            conv.customer_name = current["customer_name"]

        db.commit()
        db.refresh(conv)
        return current

    @staticmethod
    def list_recent_conversations(db: Session, limit: int = 20) -> List[Conversation]:
        return (
            db.query(Conversation)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .all()
        )


conversation_service = ConversationService()

