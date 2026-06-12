"""Chat endpoints — RAG-based Q&A over transcripts."""

import uuid

from fastapi import APIRouter, HTTPException

from src.api.deps import CurrentUser, DB
from src.models.chat_message import ChatMessage
from src.models.recording import Recording
from src.schemas.chat import ChatRequest
from src.services.chat_service import chat_with_transcript

router = APIRouter()


@router.get("/{recording_id}/chat")
async def get_chat_history(
    recording_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    result = await db.execute(
        ChatMessage.__table__.select()
        .where(ChatMessage.recording_id == recording_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.fetchall()
    return [
        {"id": str(m.id), "role": m.role, "content": m.content}
        for m in messages
    ]


@router.post("/{recording_id}/chat")
async def send_chat_message(
    recording_id: uuid.UUID,
    body: ChatRequest,
    db: DB,
    current_user: CurrentUser,
):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    # Save user message
    user_msg = ChatMessage(
        recording_id=recording_id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)

    # Load chat history for context
    history_result = await db.execute(
        ChatMessage.__table__.select()
        .where(ChatMessage.recording_id == recording_id)
        .order_by(ChatMessage.created_at)
        .limit(20)
    )
    history = [{"role": m.role, "content": m.content} for m in history_result.fetchall()]

    # Get response via RAG
    try:
        response_text = chat_with_transcript(
            str(recording_id), body.message, history
        )
    except Exception as e:
        response_text = f"I'm sorry, I couldn't process your question. Error: {str(e)}"

    # Save assistant message
    assistant_msg = ChatMessage(
        recording_id=recording_id,
        role="assistant",
        content=response_text,
    )
    db.add(assistant_msg)
    await db.commit()

    return {"response": response_text}
