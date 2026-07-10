"""Chapter-text embedding helpers (Phase 4.3) — pure, I/O-free, testable.

The enrichment pipeline embeds fic METADATA today. This module adds the
machinery to also embed a sample of the actual chapter PROSE and blend the
two into one richer semantic vector, stored in-place in the existing
fanfics.embedding_vec (no second column → preserves Neon free-tier
capacity).

Pipeline (all in internal.py's enrich loop, using these helpers):
    plain  = html_to_text(chapter html)          # I/O done by caller
    chunks = select(chunk(plain), MAX_TEXT_CHARS) # head+middle+tail sample
    vecs   = embed([meta_text] + chunks)          # ONE worker call
    text_vec = pool(vecs[1:], [len(c) for c in chunks])
    final    = blend(vecs[0], text_vec, alpha)    # convex, re-normalized

Everything degrades to metadata-only if chapter text is missing/failed —
enrichment never fails just because prose couldn't be fetched.
"""
from __future__ import annotations
import math
import re
from typing import Optional

# Defaults; the enrich loop passes the real settings values in.
CHUNK_CHARS = 2200        # ~730-880 RU tokens, far under bge-m3's 8192 ceiling
CHUNK_OVERLAP = 220       # 10% sliding-window overlap
MAX_TEXT_CHARS = 16000    # ~6k tokens total prose budget per fic
_MIN_TAIL = 200           # merge a trailing chunk shorter than this
_SNAP_WINDOW = 150        # snap a window end to a boundary within ±this many chars


def l2norm(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v))
    if n < 1e-9:
        return v
    return [x / n for x in v]


def _norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def html_to_text(html: str) -> str:
    """Strip ficbook chapter HTML (div#content inner HTML) to plain text.
    BeautifulSoup get_text + whitespace collapse. Returns '' on empty/None."""
    if not html:
        return ""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        # Drop script/style noise defensively (chapter HTML rarely has them).
        for bad in soup(["script", "style"]):
            bad.decompose()
        text = soup.get_text(" ", strip=True)
    except Exception:
        # Last-ditch: regex tag strip.
        text = re.sub(r"<[^>]+>", " ", html)
    # Collapse runs of whitespace to single spaces, keep paragraph breaks.
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip()


def chunk(text: str, *, chunk_chars: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Sliding-window split. Snaps each window end to the nearest sentence/
    paragraph boundary within ±_SNAP_WINDOW chars; merges a tiny trailing
    chunk into its predecessor. Returns [] for empty input."""
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= chunk_chars:
        return [text]

    stride = max(1, chunk_chars - overlap)
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_chars, n)
        if end < n:
            # Snap end to a boundary (., !, ?, newline) within the window.
            snap = _snap_end(text, end)
            if snap > start:
                end = snap
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(start + stride, end - overlap)

    # Merge a too-short tail into the previous chunk.
    if len(chunks) >= 2 and len(chunks[-1]) < _MIN_TAIL:
        chunks[-2] = (chunks[-2] + " " + chunks[-1]).strip()
        chunks.pop()
    return chunks


def _snap_end(text: str, end: int) -> int:
    """Find a sentence/paragraph boundary near `end`, preferring the closest
    one within ±_SNAP_WINDOW. Returns `end` unchanged if none found."""
    lo = max(0, end - _SNAP_WINDOW)
    hi = min(len(text), end + _SNAP_WINDOW)
    best = -1
    for m in re.finditer(r"[.!?…]\s|\n", text[lo:hi]):
        pos = lo + m.end()
        if best == -1 or abs(pos - end) < abs(best - end):
            best = pos
    return best if best != -1 else end


def select(chunks: list[str], budget: int = MAX_TEXT_CHARS) -> list[str]:
    """Pick a coverage-preserving subset within `budget` total chars.
    Always keeps the first (opening) and last (ending) chunk; fills the
    middle by evenly striding so the whole arc is represented, not just
    the start. Preserves original order."""
    if not chunks:
        return []
    total = sum(len(c) for c in chunks)
    if total <= budget:
        return chunks
    if len(chunks) == 1:
        return chunks[:1]

    keep_idx = {0, len(chunks) - 1}
    used = len(chunks[0]) + len(chunks[-1])
    # Evenly stride through the middle, adding while budget allows.
    middle = list(range(1, len(chunks) - 1))
    if middle:
        # Order middle indices by even spacing outward from the centre so we
        # sample representatively rather than front-loading.
        ordered = sorted(middle, key=lambda i: abs(i - len(chunks) / 2))
        for i in ordered:
            if used + len(chunks[i]) > budget:
                continue
            keep_idx.add(i)
            used += len(chunks[i])
    return [c for i, c in enumerate(chunks) if i in keep_idx]


def pool(vecs: list[list[float]], lens: list[int]) -> Optional[list[float]]:
    """Length-weighted mean of chunk vectors → single L2-normalized text_vec.
    Each vector is L2-normalized first; zero-norm vectors are dropped. Returns
    None if no vector survives (→ caller falls back to metadata-only)."""
    if not vecs:
        return None
    pairs = []
    for v, L in zip(vecs, lens):
        if not v:
            continue
        nv = l2norm(v)
        if _norm(nv) < 1e-9:
            continue
        pairs.append((nv, max(1, int(L))))
    if not pairs:
        return None
    if len(pairs) == 1:
        return l2norm(pairs[0][0])

    total_len = sum(L for _, L in pairs) or 1
    dim = len(pairs[0][0])
    acc = [0.0] * dim
    for nv, L in pairs:
        w = L / total_len
        for i in range(dim):
            acc[i] += w * nv[i]
    return l2norm(acc)


def blend(
    meta_vec: list[float],
    text_vec: Optional[list[float]],
    alpha: float = 0.5,
) -> list[float]:
    """Convex blend of independently L2-normalized meta + text vectors, then
    re-normalize (embedding_vec is queried with cosine, so it must be unit).
    text_vec None → returns normalized meta_vec (today's behavior exactly)."""
    meta_hat = l2norm(meta_vec)
    if text_vec is None:
        return meta_hat
    text_hat = l2norm(text_vec)
    a = max(0.0, min(1.0, alpha))
    dim = len(meta_hat)
    blended = [a * meta_hat[i] + (1.0 - a) * text_hat[i] for i in range(dim)]
    return l2norm(blended)
