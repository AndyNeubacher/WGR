"""
PaddleOCR sidecar — extracts serial number + consumed volume from a meter photo.

The Node.js worker calls POST /ocr with {"path": "<absolute filesystem path>"}.
This service runs PaddleOCR on the image, then applies two cheap heuristics on
the recognised tokens to guess the serial and the volume. The technician
verifies and corrects in the UI, so the heuristics only need to be useful, not
perfect.
"""
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from paddleocr import PaddleOCR

# `lang='german'` includes Latin diacritics; for digit-heavy meter dials this
# is rarely better than 'en', but it's the right default for a German market.
ocr = PaddleOCR(use_angle_cls=True, lang='german', show_log=False)

app = FastAPI()


class OcrRequest(BaseModel):
    path: str


class OcrTextEntry(BaseModel):
    text: str
    confidence: float
    bbox: list[list[float]]


class OcrResponse(BaseModel):
    serialNumber: Optional[str] = None
    consumedVolume: Optional[float] = None
    raw: list[OcrTextEntry]


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/ocr', response_model=OcrResponse)
def run_ocr(req: OcrRequest):
    try:
        result = ocr.ocr(req.path, cls=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    raw: list[OcrTextEntry] = []
    texts: list[str] = []
    for page in (result or []):
        for entry in (page or []):
            try:
                bbox, (text, conf) = entry
            except (ValueError, TypeError):
                continue
            raw.append(OcrTextEntry(
                text=text,
                confidence=float(conf),
                bbox=[[float(p[0]), float(p[1])] for p in bbox],
            ))
            texts.append(text)

    return OcrResponse(
        serialNumber=pick_serial(texts),
        consumedVolume=pick_volume(texts),
        raw=raw,
    )


def pick_serial(texts: list[str]) -> Optional[str]:
    """Heuristic: longest alphanumeric token (>= 5 chars) that contains a digit."""
    candidates: list[str] = []
    for t in texts:
        for tok in re.findall(r'[A-Za-z0-9\-]{5,}', t):
            if any(c.isdigit() for c in tok):
                candidates.append(tok)
    if not candidates:
        return None
    candidates.sort(key=len, reverse=True)
    return candidates[0]


def pick_volume(texts: list[str]) -> Optional[float]:
    """Heuristic: largest decimal number that fits a plausible meter reading."""
    nums: list[float] = []
    for t in texts:
        for m in re.findall(r'\d{1,8}(?:[.,]\d{1,3})?', t):
            try:
                v = float(m.replace(',', '.'))
            except ValueError:
                continue
            # Skip implausible values (years, single digits) — keep tunable.
            if 0 < v < 1_000_000:
                nums.append(v)
    if not nums:
        return None
    return max(nums)
