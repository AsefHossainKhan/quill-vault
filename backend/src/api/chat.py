"""Chat endpoints — transcript-aware Q&A with context selection."""

import uuid

from fastapi import APIRouter, HTTPException

from src.api.deps import CurrentUser, DB
from src.models.chat_message import ChatMessage
from src.models.recording import Recording
from src.models.transcript import Transcript
from src.schemas.chat import ChatRequest
from src.services.chat_service import chat_with_transcript

router = APIRouter()

VALID_CONTEXT_TYPES = {"raw", "diarized", "named", "output"}


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

    # Fetch selected transcript content from DB
    context_texts: dict[str, str] = {}
    if body.context_types:
        requested = [t for t in body.context_types if t in VALID_CONTEXT_TYPES]
        if requested:
            tx_result = await db.execute(
                Transcript.__table__.select().where(
                    Transcript.recording_id == recording_id,
                    Transcript.type.in_(requested),
                )
            )
            for row in tx_result.fetchall():
                context_texts[row.type] = row.content

    # Get response via LLM with transcript context
    try:
        response_text = chat_with_transcript(
            str(recording_id),
            body.message,
            history,
            context_texts=context_texts or None,
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


@router.delete("/{recording_id}/chat")
async def reset_chat_history(
    recording_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    recording = await db.get(Recording, recording_id)
    if not recording or recording.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    await db.execute(
        ChatMessage.__table__.delete().where(
            ChatMessage.recording_id == recording_id
        )
    )
    await db.commit()
    return {"detail": "Chat history cleared"}
