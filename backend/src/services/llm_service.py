"""LangChain LLM instance — provider-agnostic via langchain-openai."""

from functools import lru_cache

from langchain_openai import ChatOpenAI

from src.config import get_settings


@lru_cache(maxsize=1)
def get_llm() -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=settings.LLM_MODEL,
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
        max_tokens=settings.LLM_MAX_TOKENS,
        temperature=0.3,
    )
