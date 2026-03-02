import re
from dataclasses import dataclass


@dataclass
class TextChunk:
    chunk_index: int
    section_title: str
    text: str


HEADING_PATTERN = re.compile(r"^\s*(#{1,6}\s+.+|[A-Z][A-Za-z0-9\s/&\-]{3,60}:?)\s*$")


def split_into_sections(text: str) -> list[tuple[str, str]]:
    lines = [line.rstrip() for line in text.splitlines()]
    sections: list[tuple[str, list[str]]] = []
    current_title = "General"
    current_lines: list[str] = []

    for line in lines:
        if HEADING_PATTERN.match(line) and len(line.split()) <= 12:
            if current_lines:
                sections.append((current_title, current_lines))
            current_title = line.strip("# ").strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_title, current_lines))

    cleaned: list[tuple[str, str]] = []
    for title, body_lines in sections:
        body = "\n".join([l for l in body_lines if l.strip()]).strip()
        if body:
            cleaned.append((title or "General", body))
    return cleaned


def token_windows(text: str, chunk_size: int = 700, overlap: int = 100) -> list[str]:
    # Uses word windows as an approximate token strategy for MVP speed/reliability.
    words = text.split()
    if not words:
        return []

    if overlap >= chunk_size:
        overlap = 0

    step = chunk_size - overlap
    chunks = []
    for start in range(0, len(words), step):
        end = start + chunk_size
        window = words[start:end]
        if not window:
            continue
        chunks.append(" ".join(window))
        if end >= len(words):
            break
    return chunks


def chunk_document(text: str, chunk_size: int = 700, overlap: int = 100) -> list[TextChunk]:
    chunks: list[TextChunk] = []
    idx = 0
    for section_title, section_body in split_into_sections(text):
        for c in token_windows(section_body, chunk_size=chunk_size, overlap=overlap):
            chunks.append(TextChunk(chunk_index=idx, section_title=section_title, text=c))
            idx += 1
    return chunks
