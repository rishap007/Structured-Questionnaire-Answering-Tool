from __future__ import annotations
import logging
from typing import Any, Optional

import chromadb
from openai import OpenAI
from openai import OpenAIError

from ..config import settings

logger = logging.getLogger(__name__)


class Retriever:
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key, max_retries=0, timeout=20.0) if settings.openai_api_key else None
        self.openai_available = bool(self.client)
        self.chroma = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        self.collection = self.chroma.get_or_create_collection(
            name="reference_chunks",
            metadata={"hnsw:space": "cosine"},
        )

    def _embedding(self, text: str) -> list[float]:
        if not self.client:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        res = self.client.embeddings.create(model=settings.openai_embedding_model, input=text)
        return res.data[0].embedding

    def add_chunks(self, chunks: list[dict[str, Any]]):
        if not chunks:
            return

        ids = [c["vector_id"] for c in chunks]
        docs = [c["chunk_text"] for c in chunks]
        metas = [
            {
                "document_id": c["document_id"],
                "document_name": c["document_name"],
                "section_title": c["section_title"],
            }
            for c in chunks
        ]
        if self.openai_available and self.client:
            try:
                embs = [self._embedding(d) for d in docs]
                self.collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embs)
                return
            except OpenAIError as exc:
                self.openai_available = False
                logger.warning("Embedding API failed; falling back to Chroma text-query mode: %s", exc)
            except Exception as exc:  # pragma: no cover - defensive fallback
                self.openai_available = False
                logger.warning("Embedding pipeline failed; falling back to Chroma text-query mode: %s", exc)
        else:
            logger.info("OPENAI_API_KEY not set; using Chroma text-query mode for retrieval")
        self.collection.upsert(ids=ids, documents=docs, metadatas=metas)

    def retrieve(self, question: str, k: int = 3, document_ids: Optional[list[str]] = None) -> list[dict[str, Any]]:
        query_kwargs: dict[str, Any] = {"n_results": k}
        use_query_texts = False
        if self.openai_available and self.client:
            try:
                question_emb = self._embedding(question)
                query_kwargs["query_embeddings"] = [question_emb]
            except OpenAIError as exc:
                self.openai_available = False
                logger.warning("Query embedding API failed; using Chroma text-query mode: %s", exc)
                use_query_texts = True
            except Exception as exc:  # pragma: no cover - defensive fallback
                self.openai_available = False
                logger.warning("Query embedding pipeline failed; using Chroma text-query mode: %s", exc)
                use_query_texts = True
        else:
            use_query_texts = True

        if use_query_texts:
            query_kwargs["query_texts"] = [question]

        if document_ids:
            query_kwargs["where"] = {"document_id": {"$in": document_ids}}
        result = self.collection.query(**query_kwargs)

        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        hits = []
        for hit_id, doc, meta, dist in zip(ids, docs, metas, distances):
            similarity = max(0.0, 1 - float(dist))
            hits.append(
                {
                    "id": hit_id,
                    "text": doc,
                    "metadata": meta,
                    "distance": float(dist),
                    "similarity": similarity,
                }
            )
        return hits


retriever = Retriever()
