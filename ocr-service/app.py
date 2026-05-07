"""
PaddleOCR sidecar — extracts serial number + consumed volume from a meter photo.

The Node.js worker calls POST /ocr with {"path": "<absolute filesystem path>"}.
This service first attempts to detect and decode 2D barcodes (QR codes, DataMatrix, etc.)
If a barcode is found with the expected format (serialnumber;calibration-month;calibration-year;type;),
the serial number is extracted from it. Otherwise, falls back to PaddleOCR + heuristics.
The technician verifies and corrects in the UI, so the heuristics only need to be useful, not perfect.
"""
import os
import re
import cv2
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO)
# Uvicorn overrides standard logging configuration, so we attach to its logger
logger = logging.getLogger("uvicorn.error")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from paddleocr import PaddleOCR
from pyzbar import pyzbar
from pylibdmtx import pylibdmtx
import cv2
import numpy as np
from src.obj_detection import ObjDetection

# `lang='german'` includes Latin diacritics; for digit-heavy meter dials this
# is rarely better than 'en', but it's the right default for a German market.
ocr = PaddleOCR(use_angle_cls=True, lang='german', show_log=False)

ROBOFLOW_API_KEY = "hyav9bBDrlwRh16JGxo8"
ROBOFLOW_MODEL_ID = "watermeter-vtc1a/3"
obj_detection_model = ObjDetection(api_key=ROBOFLOW_API_KEY, model_id=ROBOFLOW_MODEL_ID, offline_mode=False, use_vision_model=True)

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


def barcode_robust_decode(image: np.ndarray) -> list:
    """
    Attempts to decode barcodes using multiple libraries and preprocessing steps.
    Returns a unified list of decoded objects.
    """
    if image is None:
        return []
        
    results = []
    
    # 1. Try libraries directly
    try:
        results.extend(pyzbar.decode(image))
    except Exception:
        pass
    try:
        results.extend(pylibdmtx.decode(image))
    except Exception:
        pass
        
    if results:
        return results
        
    # 2. Try Preprocessing: Grayscale + Padding + Thresholding
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        # Add Quiet Zone (white border)
        padded = cv2.copyMakeBorder(gray, 30, 30, 30, 30, cv2.BORDER_CONSTANT, value=255)
        # Binarization
        _, thresh = cv2.threshold(padded, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        #cv2.imshow("Thresholded Image", thresh)
        
        results.extend(pyzbar.decode(thresh))
        results.extend(pylibdmtx.decode(thresh))
        
        if not results:
            # Try one more with resizing
            resized = cv2.resize(thresh, (0, 0), fx=2, fy=2, interpolation=cv2.INTER_LINEAR)
            results.extend(pyzbar.decode(resized))
            results.extend(pylibdmtx.decode(resized))
            
    except Exception:
        pass
        
    return results


@app.post('/ocr', response_model=OcrResponse)
def run_ocr(req: OcrRequest):
    logger.info(f"Received OCR request for path: {req.path}")

    if not os.path.isfile(req.path):
        logger.error(f"Invalid file path: {req.path}")
        raise HTTPException(status_code=400, detail="Invalid file path")

    ext = os.path.splitext(req.path)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']:
        logger.error(f"Unsupported file extension: {ext}")
        raise HTTPException(status_code=400, detail="Unsupported file extension")

    # np.fromfile + imdecode handles non-ASCII paths that cv2.imread chokes on.
    try:
        img = cv2.imdecode(np.fromfile(req.path, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        img = cv2.imread(req.path)

    if img is None:
        raise HTTPException(status_code=500, detail="Could not load image")

    raw: list[OcrTextEntry] = []

    # 1) Serial number from the barcode region.
    serial_number: Optional[str] = None
    barcode_img = obj_detection_model.getBBoxImage(img, "barcode")
    if barcode_img is not None:
        for obj in barcode_robust_decode(barcode_img):
            try:
                data = obj.data.decode('utf-8')
                parts = data.split(';')
                if parts and parts[0]:
                    serial_number = parts[0]
                    logger.info(f"Detected barcode serial: {serial_number}")
                    break
            except Exception as e:
                logger.error(f"Error decoding barcode payload: {e}")

    # 2-3) Consumed volume from the cropped consumption region.
    consumed_volume: Optional[float] = None
    consumption_img = obj_detection_model.getBBoxImage(img, "consumption")
    if consumption_img is not None:
        try:
            consumption_texts = _ocr_to_texts(ocr.ocr(consumption_img, cls=True), raw)
            consumed_volume = pick_volume(consumption_texts)
        except Exception as e:
            logger.error(f"Error OCR-ing consumption region: {e}")

    # 4-5) Serial number from the cropped serialnumber region (fallback when barcode failed).
    if not serial_number:
        serial_img = obj_detection_model.getBBoxImage(img, "serialnumber")
        if serial_img is not None:
            try:
                serial_texts = _ocr_to_texts(ocr.ocr(serial_img, cls=True), raw)
                serial_number = pick_serial(serial_texts)
            except Exception as e:
                logger.error(f"Error OCR-ing serialnumber region: {e}")

    logger.info(f"Picked serial: {serial_number}, volume: {consumed_volume}")

    return OcrResponse(
        serialNumber=serial_number,
        consumedVolume=consumed_volume,
        raw=raw,
    )


def _ocr_to_texts(result, raw: list[OcrTextEntry]) -> list[str]:
    """Flatten a PaddleOCR result, appending each entry to `raw` and returning the texts."""
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
    return texts


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


if __name__ == "__main__":
    
    test_image_filename = "test_210.jpg"
    test_image_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), test_image_filename)
    
    try:
        img = cv2.imdecode(np.fromfile(test_image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        img = cv2.imread(test_image_path)
    
    if img is not None:
        barcode = obj_detection_model.getBBoxImage(img, "barcode")
        serial = obj_detection_model.getBBoxImage(img, "serialnumber")
        consumption = obj_detection_model.getBBoxImage(img, "consumption")

        if barcode is not None:
            cv2.imshow("barcode", barcode)
            decoded_objects = barcode_robust_decode(barcode)
            if decoded_objects:
                for obj in decoded_objects:
                    print(f"Decoded barcode: {obj.data.decode('utf-8')}")
            else:
                print("Barcode match found by ObjDetection, but could not be decoded by pyzbar/pylibdmtx.")

        if serial is not None:      cv2.imshow("serial", serial)
        if consumption is not None: cv2.imshow("consumption", consumption)
        
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    else:
        print(f"Could not load image: {test_image_path}")
