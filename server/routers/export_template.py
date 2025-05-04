from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import json

router = APIRouter()

EXPORT_TEMPLATE_DIR = "data/export_templates"
DEFAULT_TEMPLATE_FILE = os.path.join(EXPORT_TEMPLATE_DIR, "default_template.json")
os.makedirs(EXPORT_TEMPLATE_DIR, exist_ok=True)

class ExportField(BaseModel):
    name: str
    active: bool
    system: bool
    label: str
    info: Optional[str] = None
    example: Optional[str] = None
    type: Optional[str] = None

@router.post("/save")
async def save_export_template(fields: List[ExportField]):
    try:
        with open(DEFAULT_TEMPLATE_FILE, "w", encoding="utf-8") as f:
            json.dump([field.dict() for field in fields], f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Export template saved successfully."}

@router.get("/load")
async def load_export_template():
    if not os.path.exists(DEFAULT_TEMPLATE_FILE):
        return []
    try:
        with open(DEFAULT_TEMPLATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
