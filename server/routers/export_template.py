from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

try:
    from path_utils import EXPORT_TEMPLATE_DIR
except ImportError:
    from server.path_utils import EXPORT_TEMPLATE_DIR

router = APIRouter()

DEFAULT_TEMPLATE_FILE = EXPORT_TEMPLATE_DIR / "default_template.json"
EXPORT_TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

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
        with DEFAULT_TEMPLATE_FILE.open("w", encoding="utf-8") as f:
            json.dump([field.dict() for field in fields], f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Export template saved successfully."}

@router.get("/load")
async def load_export_template():
    if not DEFAULT_TEMPLATE_FILE.exists():
        return []
    try:
        with DEFAULT_TEMPLATE_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
