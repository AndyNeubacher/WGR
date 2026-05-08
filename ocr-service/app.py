"""
Sidecar — extracts serial number + consumed volume from a meter photo.

The Node.js worker calls POST /ocr with {"path": "<absolute filesystem path>"}.
The service decodes 2D barcodes (QR / DataMatrix) on the barcode crop for the
serial number, and runs a Roboflow digit-detection model on the consumption
crop to read the gauge numerals. The technician verifies and corrects in the UI.
"""
import os
import cv2
import logging
from typing import Optional
import time

logging.basicConfig(level=logging.INFO)
# Uvicorn overrides standard logging configuration, so we attach to its logger
logger = logging.getLogger("uvicorn.error")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pyzbar import pyzbar
from pylibdmtx import pylibdmtx
import cv2
import numpy as np
from src.obj_detection import ObjDetection

ROBOFLOW_API_KEY = "hyav9bBDrlwRh16JGxo8"
GAUGE_MODEL_ID = "watermeter-vtc1a/4"
DIGIT_MODEL_ID = "gaugenumbers/2"
obj_detection_model = ObjDetection(api_key=ROBOFLOW_API_KEY, model_id=GAUGE_MODEL_ID, offline_mode=True)
digit_detection_model = ObjDetection(api_key=ROBOFLOW_API_KEY, model_id=DIGIT_MODEL_ID, offline_mode=True)

app = FastAPI()


class OcrRequest(BaseModel):
    path: str


class OcrResponse(BaseModel):
    serialNumber: Optional[str] = None
    consumedVolume: Optional[int] = None


@app.get('/health')
def health():
    return {'status': 'ok'}


def detect_rotation(image: np.ndarray) -> int:
    """
    Detect the skew of a meter crop in degrees, rounded to the nearest int.
    Positive = the image is tilted clockwise (top of the digit row leans right);
    feed the returned value straight into rotate_image() to level it.
    Returns 0 if no clear skew is found.
    """
    if image is None or image.size == 0:
        return 0

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    min_len = max(20, min(image.shape[:2]) // 4)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80,
                            minLineLength=min_len, maxLineGap=20)
    if lines is None:
        return 0

    angles = []
    for x1, y1, x2, y2 in lines[:, 0]:
        a = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        # Fold to [-45, 45] so horizontal and vertical edges agree on the same skew.
        if a < -45:
            a += 90
        elif a > 45:
            a -= 90
        angles.append(a)

    return int(round(float(np.median(angles))))


def rotate_image(image: np.ndarray, angle: float) -> np.ndarray:
    """Rotate `image` around its center by `angle` degrees, expanding the canvas to fit."""
    if image is None or angle == 0:
        return image

    h, w = image.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    cos, sin = abs(M[0, 0]), abs(M[0, 1])
    new_w = int(h * sin + w * cos)
    new_h = int(h * cos + w * sin)
    M[0, 2] += (new_w - w) / 2
    M[1, 2] += (new_h - h) / 2
    return cv2.warpAffine(image, M, (new_w, new_h),
                          flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))


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

    # Detect skew from the consumption crop and level the full image before
    # extracting any bbox we actually use — so every downstream crop is straight.
    consumption_probe = obj_detection_model.getBBoxImage(img, "consumption")
    rotation = detect_rotation(consumption_probe)
    if rotation != 0:
        logger.info(f"Leveling image by {rotation}°")
        img = rotate_image(img, rotation)

    # 1a) Serial number from the barcode region.
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

    # 1b) Fallback: detect serial-number characters on the cropped serialnumber region.
    #     Same pattern as the gauge model — each character is its own bbox; sort
    #     left-to-right by x-coordinate and concatenate the class names.
    if not serial_number:
        serial_img = obj_detection_model.getBBoxImage(img, "serialnumber")
        if serial_img is not None:
            try:
                char_bboxes = digit_detection_model.getAllBBoxes(serial_img)
                char_bboxes.sort(key=lambda b: b["bbox"][0])
                chars = "".join(str(b.get("class", "")) for b in char_bboxes)
                if chars:
                    serial_number = chars
            except Exception as e:
                logger.error(f"Error detecting serial number characters: {e}")

    # 2) Consumed volume from the cropped consumption region.
    #    The "gaugenumbers/2" model detects each digit as its own bbox, with the
    #    class name being the digit (e.g. "0".."9"). Sort detections left-to-right
    #    by x-coordinate and concatenate to recover the meter reading.
    consumed_volume: Optional[int] = None
    consumption_img = obj_detection_model.getBBoxImage(img, "consumption")
    if consumption_img is not None:
        try:
            digit_bboxes = digit_detection_model.getAllBBoxes(consumption_img)
            digit_bboxes.sort(key=lambda b: b["bbox"][0])
            digits = "".join(str(b.get("class", "")) for b in digit_bboxes)
            if digits.isdigit():
                consumed_volume = int(digits)
            else:
                logger.error(f"Gauge detection produced non-digit classes: {digits!r}")
        except Exception as e:
            logger.error(f"Error detecting gauge numbers: {e}")

    logger.info(f"Picked serial: {serial_number}, volume: {consumed_volume}")

    return OcrResponse(
        serialNumber=serial_number,
        consumedVolume=consumed_volume,
    )


def test_single_image(image_path: str, output_dir: str):
    """
    Run the meter pipeline on `image_path` and write the bbox crops into
    `output_dir`. Each crop is saved as "<label>_<original_filename>", with
    label ∈ {"barcode", "serial", "consumption"}.
    """
    image_name = os.path.basename(image_path)

    try:
        img = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        img = cv2.imread(image_path)

    if img is None:
        print(f"Could not load image: {image_path}")
        return

    consumption_initial = obj_detection_model.getBBoxImage(img, "consumption")
    rotation = detect_rotation(consumption_initial)
    print(f"[{image_name}] Detected rotation: {rotation}")
    img = rotate_image(img, rotation)

    crops = {
        "barcode": obj_detection_model.getBBoxImage(img, "barcode"),
        "serial": obj_detection_model.getBBoxImage(img, "serialnumber"),
        "consumption": obj_detection_model.getBBoxImage(img, "consumption"),
    }

    # cv2.imencode + tofile handles non-ASCII paths that cv2.imwrite chokes on.
    ext = os.path.splitext(image_name)[1] or ".jpg"
    for label, crop in crops.items():
        if crop is None:
            continue
        out_path = os.path.join(output_dir, f"{label}_{image_name}")
        ok, buf = cv2.imencode(ext, crop)
        if ok:
            buf.tofile(out_path)

    barcode = crops["barcode"]
    if barcode is not None:
        decoded_objects = barcode_robust_decode(barcode)
        if decoded_objects:
            for obj in decoded_objects:
                print(f"  Decoded barcode: {obj.data.decode('utf-8')}")
        else:
            print("  Barcode crop found, but could not be decoded by pyzbar/pylibdmtx.")




if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        img = cv2.imdecode(np.fromfile(os.path.join(base_dir, "test_images/PXL_20260504_065648132.MP.jpg"), dtype=np.uint8), cv2.IMREAD_COLOR)
        time.sleep(60)
        # 1. detect and correct rotation
        consumption_probe = obj_detection_model.getBBoxImage(img, "consumption")
        cv2.imshow("Consumption Probe", consumption_probe)
        rotation = detect_rotation(consumption_probe)
        if rotation != 0:
            logger.info(f"Leveling image by {rotation}°")
            img = rotate_image(img, rotation)
            cv2.imshow("Rotated Image", img)

        # 2. get consumption crop
        crop_consumption = obj_detection_model.getBBoxImage(img, "consumption")
        if crop_consumption is None:
            logger.error("Could not get consumption crop")
            exit(0)
        cv2.imshow("Consumption Crop", crop_consumption)

        # 3. detect digits from cropped image
        digit_bboxes = digit_detection_model.getAllBBoxes(crop_consumption)
        digit_bboxes.sort(key=lambda b: b["bbox"][0])
        digits = "".join(str(b.get("class", "")) for b in digit_bboxes)
        print(f"Digits: {digits}")

    
        

    except Exception as e:
        logger.error(f"Error detecting gauge numbers: {e}")
    cv2.waitKey(0)
    cv2.destroyAllWindows()
    exit(0)


    test_folder = os.path.join(base_dir, "test_images")
    output_dir = os.path.join(test_folder, "crops")
    os.makedirs(output_dir, exist_ok=True)

    image_files = [f for f in os.listdir(test_folder)
                   if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'))]

    for image_file in image_files:
        test_single_image(os.path.join(test_folder, image_file), output_dir)