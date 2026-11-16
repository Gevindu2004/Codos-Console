import csv
import io
import json
from pathlib import Path
from pypdf import PdfReader
from docx import Document as DocxDocument


def extract_text_from_file(file_path: str) -> str:
    """Extracts clean plain text from PDF, DOCX, CSV, JSONL, YAML, MD, or TXT."""
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".pdf":
        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip()

    if ext == ".docx":
        doc = DocxDocument(str(path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs).strip()

    if ext == ".csv":
        raw = path.read_text(encoding="utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(raw))
        rows = [
            " | ".join(f"{k}: {v}" for k, v in row.items() if v is not None)
            for row in reader
        ]
        return "\n".join(rows).strip()

    if ext == ".jsonl":
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        parsed = []
        for line in lines:
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                parsed.append(" | ".join(f"{k}: {v}" for k, v in obj.items()))
            except json.JSONDecodeError:
                parsed.append(line)
        return "\n".join(parsed).strip()

    # Fallback for .txt, .md, .yaml, .yml, .json
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def chunk_text(text: str, chunk_size_tokens: int = 512, overlap_tokens: int = 64) -> list[str]:
    """
    Splits extracted text into overlapping chunks calibrated by approximate token count (~4 chars/token).
    """
    if not text.strip():
        return []

    max_chars = max(400, chunk_size_tokens * 4)
    overlap_chars = max(50, overlap_tokens * 4)
    step = max(100, max_chars - overlap_chars)

    chunks: list[str] = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + max_chars, text_len)
        # Snap to nearest whitespace/newline if not at end of document
        if end < text_len:
            newline_pos = text.rfind("\n", start + int(max_chars * 0.6), end)
            space_pos = text.rfind(" ", start + int(max_chars * 0.6), end)
            snap = max(newline_pos, space_pos)
            if snap > start:
                end = snap

        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)

        if end >= text_len:
            break
        start += step

    return chunks