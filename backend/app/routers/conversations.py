import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation
from app.schemas import ConversationDetailResponse, ConversationMessageSchema
from app.services.conversation_service import conversation_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=List[ConversationDetailResponse])
def list_conversations(db: Session = Depends(get_db)):
    """
    Lists recent multi-turn conversation sessions.
    """
    convs = conversation_service.list_recent_conversations(db, limit=20)
    results = []
    for c in convs:
        messages = conversation_service.get_conversation_messages(db, c.id)
        results.append(
            ConversationDetailResponse(
                id=c.id,
                session_id=c.session_id,
                customer_name=c.customer_name,
                language_code=c.language_code,
                context_state=conversation_service.get_context_state(c),
                messages=[ConversationMessageSchema.model_validate(m) for m in messages],
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )
    return results


@router.get("/{session_id}", response_model=ConversationDetailResponse)
def get_conversation(session_id: str, db: Session = Depends(get_db)):
    """
    Retrieves full message logs and accumulated context state for a given session ID.
    """
    conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail=f"Conversation session '{session_id}' not found.")

    messages = conversation_service.get_conversation_messages(db, conv.id)
    return ConversationDetailResponse(
        id=conv.id,
        session_id=conv.session_id,
        customer_name=conv.customer_name,
        language_code=conv.language_code,
        context_state=conversation_service.get_context_state(conv),
        messages=[ConversationMessageSchema.model_validate(m) for m in messages],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )

