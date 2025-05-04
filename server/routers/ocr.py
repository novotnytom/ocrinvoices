from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import List
from PIL import Image
import pytesseract
import io
import json

router = APIRouter()

class Zone(BaseModel):
    id: int
    x: int
    y: int
    width: int
    height: int
    propertyName: str

class OCRResult(BaseModel):
    propertyName: str
    text: str
    success: bool

@router.post("/test")
async def ocr_test(image: UploadFile = File(...), zones: str = Form(...)):
    zone_list = [Zone(**z) for z in json.loads(zones)]

    image_bytes = await image.read()
    pil_image = Image.open(io.BytesIO(image_bytes))

    results = []

    for zone in zone_list:
        crop_box = (
            zone.x,
            zone.y,
            zone.x + zone.width,
            zone.y + zone.height
        )
        cropped = pil_image.crop(crop_box)
        try:
            value = pytesseract.image_to_string(cropped).strip()
            success = True
        except Exception as e:
            print(f"[OCR] Error processing zone {zone.id}: {e}")
            value = "NaN"
            success = False
        print(f"[OCR] Zone {zone.id} ({zone.propertyName}): '{value}'")
        results.append(OCRResult(propertyName=zone.propertyName, text=value if value else "NaN", success=success))

    print("[OCR] Test OCR completed for all zones.")
    return {"results": [r.dict() for r in results]}
