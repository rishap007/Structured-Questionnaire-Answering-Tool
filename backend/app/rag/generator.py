import re

from openai import OpenAI
from openai import OpenAIError

from ..config import settings

SYSTEM_PROMPT = """You are a compliance assistant.
Answer ONLY using the provided context.
If the answer is not explicitly stated in the context,
respond exactly with: 'Not found in references.'
Write 2-5 concise sentences focused on the question.
Use precise policy language from context where possible.
Do not include claims without supporting context.
End the answer with one or more citations in this exact format:
[Document Name – Section Title]
Do not fabricate or assume anything."""


class GroundedGenerator:
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key, max_retries=0, timeout=20.0) if settings.openai_api_key else None
        self.openai_available = bool(self.client)

    def generate(self, question: str, retrieved_chunks: list[dict]) -> tuple[str, str]:
        if not self.client or not self.openai_available:
            return self._fallback_generate(question, retrieved_chunks)

        context_parts = []
        for hit in retrieved_chunks:
            md = hit["metadata"]
            label = f"[{md['document_name']} – {md['section_title']}]"
            context_parts.append(f"{label}\n{hit['text']}")

        context_text = "\n\n".join(context_parts)
        user_prompt = f"Context:\n{context_text}\n\nQuestion:\n{question}\n\nAnswer:"

        try:
            response = self.client.chat.completions.create(
                model=settings.openai_chat_model,
                temperature=settings.openai_temperature,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except OpenAIError:
            self.openai_available = False
            return self._fallback_generate(question, retrieved_chunks)
        answer = response.choices[0].message.content.strip()
        if answer == "Not found in references.":
            return answer, ""

        citations = re.findall(r"\[([^\]]+)\]", answer)
        citations = [c for c in citations if " – " in c]
        if not citations:
            return "Not found in references.", ""

        return answer, "\n".join(f"[{c}]" for c in citations)

    def _fallback_generate(self, question: str, retrieved_chunks: list[dict]) -> tuple[str, str]:
        if not retrieved_chunks:
            return "Not found in references.", ""

        query_terms = self._query_terms(question)
        candidates = []

        for hit in retrieved_chunks:
            md = hit.get("metadata", {}) or {}
            citation = f"[{md.get('document_name', 'Reference Document')} – {md.get('section_title', 'General')}]"
            for sentence in self._split_sentences(hit.get("text") or ""):
                score = self._sentence_score(sentence, query_terms)
                if sentence.strip():
                    candidates.append((score, sentence.strip(), citation))

        if not candidates:
            return "Not found in references.", ""

        candidates.sort(key=lambda x: x[0], reverse=True)
        top = candidates[:8]

        selected_sentences = []
        selected_citations = []
        seen_citations = set()

        for score, sentence, citation in top:
            if score <= 0 and selected_sentences:
                continue
            selected_sentences.append(sentence)
            if citation not in seen_citations:
                selected_citations.append(citation)
                seen_citations.add(citation)
            if len(selected_sentences) >= 3:
                break

        if not selected_sentences:
            selected_sentences.append(top[0][1])
            selected_citations.append(top[0][2])

        answer_text = " ".join(selected_sentences)
        citations_text = "\n".join(selected_citations[:3])
        return answer_text, citations_text

    @staticmethod
    def _query_terms(question: str) -> set[str]:
        stopwords = {
            "what", "when", "where", "which", "that", "this", "with", "from", "have", "about", "your", "their",
            "into", "does", "must", "shall", "should", "would", "could", "there", "such", "been", "being", "than",
            "then", "them", "they", "only", "also", "for", "and", "the", "are", "our", "you", "how", "why", "who",
        }
        terms = re.findall(r"[a-zA-Z0-9]{3,}", question.lower())
        return {t for t in terms if t not in stopwords}

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]

    @staticmethod
    def _sentence_score(sentence: str, query_terms: set[str]) -> int:
        if not query_terms:
            return 1
        words = set(re.findall(r"[a-zA-Z0-9]{3,}", sentence.lower()))
        overlap = len(words.intersection(query_terms))
        # Slightly prefer concise, direct sentences.
        length_penalty = max(0, len(sentence) - 260) // 50
        return overlap - length_penalty


generator = GroundedGenerator()
