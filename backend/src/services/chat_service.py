"""Chat with transcript — direct context injection (RAG fallback available)."""

import json
import logging

from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import get_settings
from src.services.llm_service import get_llm

logger = logging.getLogger(__name__)
settings = get_settings()


def _format_transcript_context(contexts: dict[str, str]) -> str:
    """Build a readable context block from selected transcript types."""
    parts = []
    for ttype, content in contexts.items():
        label = ttype.upper()
        # Try to parse as JSON segments for readability
        try:
            segments = json.loads(content)
            if isinstance(segments, list) and segments:
                lines = []
                for seg in segments:
                    speaker = seg.get("speaker", "")
                    text = seg.get("text", "")
                    start = seg.get("start", 0)
                    ts = f"[{int(start // 60):02d}:{int(start % 60):02d}]"
                    if speaker:
                        lines.append(f"{ts} {speaker}: {text}")
                    else:
                        lines.append(f"{ts} {text}")
                parts.append(f"=== {label} TRANSCRIPT ===\n" + "\n".join(lines))
            else:
                parts.append(f"=== {label} TRANSCRIPT ===\n{content}")
        except (json.JSONDecodeError, TypeError):
            # Output is markdown or plain text
            parts.append(f"=== {label} TRANSCRIPT ===\n{content}")
    return "\n\n".join(parts)


def chat_with_transcript(
    recording_id: str,
    question: str,
    history: list[dict],
    context_texts: dict[str, str] | None = None,
) -> str:
    """Answer a question about a recording's transcript.

    Args:
        recording_id: The recording UUID string.
        question: The user's question.
        history: Previous chat messages [{role, content}, ...].
        context_texts: Dict mapping transcript type to content, e.g.
                       {"raw": "[...]", "named": "[...]", "output": "# ..."}.
                       If None/empty, uses a generic prompt.
    """
    if context_texts:
        context = _format_transcript_context(context_texts)
    else:
        context = "(No transcript context was provided for this recording.)"

    system_prompt = (
        "You are a helpful assistant analyzing a meeting or conversation transcript. "
        "Answer the user's questions accurately based on the transcript context provided below. "
        "Be concise and specific. If the context doesn't contain enough information to answer, "
        "say so clearly.\n\n"
        f"{context}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history[-10:])
    messages.append({"role": "user", "content": question})

    llm = get_llm()
    response = llm.invoke(messages)
    return response.content if hasattr(response, "content") else str(response)
