"""Output generation — apply a template to a named transcript via LLM."""

import logging

from src.services.llm_service import get_llm

logger = logging.getLogger(__name__)


def generate_output(named_segments: list[dict], system_prompt: str) -> str:
    """
    Generate a structured output (markdown) from a named transcript.

    Args:
        named_segments: List of {start, end, speaker, text} dicts.
        system_prompt: Template system prompt.

    Returns:
        Generated markdown string.
    """
    transcript_text = "\n".join(
        f"{s['speaker']}: {s['text']}" for s in named_segments
    )

    llm = get_llm()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Transcript:\n\n{transcript_text}"},
    ]
    response = llm.invoke(messages)
    content = response.content if hasattr(response, "content") else str(response)

    # Strip code fences if present
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    logger.info(f"Generated output: {len(content)} chars")
    return content
