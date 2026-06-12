"""LLM-powered speaker name inference from transcript context."""

import json
import logging
import re

from src.services.llm_service import get_llm

logger = logging.getLogger(__name__)


def infer_speaker_names(
    segments: list[dict],
) -> tuple[list[dict], dict[str, str]]:
    """
    Use LLM to infer real speaker names from transcript context.

    Args:
        segments: [{start, end, speaker, text}, ...]

    Returns:
        named_segments: Same structure but speaker field replaced with name if found.
        name_map: {'SPEAKER_00': 'Alice', ...}
    """
    speaker_labels = list({s["speaker"] for s in segments})
    if len(speaker_labels) <= 1:
        return segments, {}

    # Build a sample of the transcript for context
    sample_text = _build_sample(segments, max_chars=4000)

    llm = get_llm()
    prompt = f"""You are analyzing a meeting transcript. Based on the content,
identify real names for the following speakers if they can be inferred
(e.g. someone is addressed by name, introduces themselves, or signs off).

Speakers: {', '.join(speaker_labels)}

Transcript sample:
{sample_text}

Respond ONLY with a JSON object mapping speaker labels to names.
If a name cannot be confidently inferred, use null.
Example: {{"SPEAKER_00": "Alice", "SPEAKER_01": null}}

JSON response:"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        # Extract JSON from response
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return segments, {}
        name_map: dict[str, str | None] = json.loads(match.group())
        # Filter out nulls
        name_map = {k: v for k, v in name_map.items() if v}
    except Exception as e:
        logger.warning(f"Speaker naming LLM call failed: {e}")
        return segments, {}

    # Apply names to segments
    named = []
    for seg in segments:
        label = seg["speaker"]
        named.append({**seg, "speaker": name_map.get(label, label)})

    return named, {k: v for k, v in name_map.items() if v}


def _build_sample(segments: list[dict], max_chars: int) -> str:
    lines = [f"{s['speaker']}: {s['text']}" for s in segments]
    sample = "\n".join(lines)
    return sample[:max_chars] + ("..." if len(sample) > max_chars else "")
