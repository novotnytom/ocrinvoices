from pathlib import Path
from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import shutil
import json
from datetime import datetime

try:
    from path_utils import QUEUE_DIR
except ImportError:
    from server.path_utils import QUEUE_DIR

router = APIRouter()

QUEUE_DIR.mkdir(parents=True, exist_ok=True)

class InvoiceQueue(BaseModel):
    name: str
    profile: str
    created: str
    updated: str
    pages: List[str]  # filenames

@router.get("/queues")
def list_queues():
    result = []
    for queue_path in QUEUE_DIR.iterdir():
        if not queue_path.is_dir():
            continue
        meta_path = queue_path / "meta.json"
        if meta_path.exists():
            with meta_path.open("r", encoding="utf-8") as f:
                result.append(json.load(f))
    return result

@router.get("/queues/{name}")
def get_queue(name: str):
    queue_path = QUEUE_DIR / name
    meta_path = queue_path / "meta.json"
    values_path = queue_path / "values.json"

    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Queue not found")

    with meta_path.open("r", encoding="utf-8") as f:
        meta = json.load(f)
    with values_path.open("r", encoding="utf-8") as f:
        values = json.load(f)

    return {
        "name": meta["name"],
        "profile": meta["profile"],
        "created": meta["created"],
        "updated": meta["updated"],
        "pages": values,
        "systemValues": meta.get("systemValues", {}),  # <-- include on GET
        "fieldMapping": meta.get("fieldMapping", {})  # <-- Add this
    }

@router.post("/queues")
def save_queue(
    name: str = Form(...),
    profile: str = Form(...),
    values: str = Form(...),
    systemValues: str = Form(None),  # <-- already present
    fieldMapping: str = Form(None),  # <-- New input
    files: List[UploadFile] = []
):
    queue_path = QUEUE_DIR / name
    queue_path.mkdir(parents=True, exist_ok=True)

    # Save images
    saved_filenames = []
    for file in files:
        out_path = queue_path / Path(file.filename).name
        with out_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        saved_filenames.append(out_path.name)

    # Save meta and values
    now = datetime.utcnow().isoformat()
    meta_path = queue_path / "meta.json"
    existing = meta_path.exists()
    created_at = now

    if existing:
        with meta_path.open("r", encoding="utf-8") as f:
            created_at = json.load(f).get("created", now)

    meta = {
        "name": name,
        "profile": profile,
        "created": created_at,
        "updated": now,
        "pages": saved_filenames,
        "systemValues": json.loads(systemValues) if systemValues else {},  # <-- save it
        "fieldMapping": json.loads(fieldMapping) if fieldMapping else {}  # <-- New line
    }

    with meta_path.open("w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    with (queue_path / "values.json").open("w", encoding="utf-8") as f:
        f.write(values)

    return {"status": "ok"}

@router.delete("/queues/{name}")
def delete_queue(name: str):
    queue_path = QUEUE_DIR / name
    if not queue_path.exists():
        raise HTTPException(status_code=404, detail="Queue not found")
    shutil.rmtree(queue_path)
    return {"status": "deleted"}

@router.get("/queues/{name}/{filename}")
def get_queue_image(name: str, filename: str):
    image_path = QUEUE_DIR / name / Path(filename).name
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)
