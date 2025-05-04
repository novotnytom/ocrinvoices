from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import os
import shutil
import json
from datetime import datetime

router = APIRouter()

QUEUE_DIR = "data/queues"
os.makedirs(QUEUE_DIR, exist_ok=True)

class InvoiceQueue(BaseModel):
    name: str
    profile: str
    created: str
    updated: str
    pages: List[str]  # filenames

@router.get("/queues")
def list_queues():
    result = []
    for folder in os.listdir(QUEUE_DIR):
        meta_path = os.path.join(QUEUE_DIR, folder, "meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                result.append(json.load(f))
    return result

@router.get("/queues/{name}")
def get_queue(name: str):
    queue_path = os.path.join(QUEUE_DIR, name)
    meta_path = os.path.join(queue_path, "meta.json")
    values_path = os.path.join(queue_path, "values.json")

    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Queue not found")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(values_path, "r", encoding="utf-8") as f:
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
    queue_path = os.path.join(QUEUE_DIR, name)
    os.makedirs(queue_path, exist_ok=True)

    # Save images
    saved_filenames = []
    for file in files:
        out_path = os.path.join(queue_path, file.filename)
        with open(out_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved_filenames.append(file.filename)

    # Save meta and values
    now = datetime.utcnow().isoformat()
    meta_path = os.path.join(queue_path, "meta.json")
    existing = os.path.exists(meta_path)

    meta = {
        "name": name,
        "profile": profile,
        "created": now if not existing else json.load(open(meta_path)).get("created", now),
        "updated": now,
        "pages": saved_filenames,
        "systemValues": json.loads(systemValues) if systemValues else {},  # <-- save it
        "fieldMapping": json.loads(fieldMapping) if fieldMapping else {}  # <-- New line
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    with open(os.path.join(queue_path, "values.json"), "w", encoding="utf-8") as f:
        f.write(values)

    return {"status": "ok"}

@router.delete("/queues/{name}")
def delete_queue(name: str):
    queue_path = os.path.join(QUEUE_DIR, name)
    if not os.path.exists(queue_path):
        raise HTTPException(status_code=404, detail="Queue not found")
    shutil.rmtree(queue_path)
    return {"status": "deleted"}

@router.get("/queues/{name}/{filename}")
def get_queue_image(name: str, filename: str):
    image_path = os.path.join(QUEUE_DIR, name, filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)
