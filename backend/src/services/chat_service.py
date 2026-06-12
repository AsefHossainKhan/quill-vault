"""RAG-based chat with transcript using ChromaDB + LLM."""

import logging

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings

from src.config import get_settings
from src.services.llm_service import get_llm

logger = logging.getLogger(__name__)
settings = get_settings()

CHROMA_PATH = "/data/chroma"


def build_vector_store(recording_id: str, named_segments: list[dict]) -> None:
    """Embed transcript chunks into ChromaDB for a recording."""
    text = "\n".join(f"{s['speaker']}: {s['text']}" for s in named_segments)
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(text)
    embeddings = _get_embeddings()
    Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        collection_name=f"rec_{recording_id}",
        persist_directory=CHROMA_PATH,
    )
    logger.info(f"Built vector store for recording {recording_id}: {len(chunks)} chunks")


def chat_with_transcript(
    recording_id: str,
    question: str,
    history: list[dict],
) -> str:
    """Answer a question about a recording's transcript using RAG."""
    embeddings = _get_embeddings()
    store = Chroma(
        collection_name=f"rec_{recording_id}",
        embedding_function=embeddings,
        persist_directory=CHROMA_PATH,
    )
    docs = store.similarity_search(question, k=4)
    context = "\n\n".join(d.page_content for d in docs)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant answering questions about a meeting transcript. "
                f"Use the following relevant context to answer accurately:\n\n{context}"
            ),
        },
        *[{"role": m["role"], "content": m["content"]} for m in history[-10:]],
        {"role": "user", "content": question},
    ]
    llm = get_llm()
    response = llm.invoke(messages)
    return response.content if hasattr(response, "content") else str(response)


def _get_embeddings():
    return SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
