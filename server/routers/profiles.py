from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
import shutil
from datetime import datetime
from typing import Optional

router = APIRouter()

PROFILE_DIR = "data/profiles"
os.makedirs(PROFILE_DIR, exist_ok=True)

class Zone(BaseModel):
    id: int
    x: int
    y: int
    width: int
    height: int
    propertyName: str

@router.get("/")
def list_profiles():
    profiles = []
    for name in os.listdir(PROFILE_DIR):
        path = os.path.join(PROFILE_DIR, name)
        if os.path.isdir(path):
            created = updated = None
            config_path = os.path.join(path, "config.json")
            if os.path.exists(config_path):
                ts = os.path.getctime(config_path)
                created = datetime.fromtimestamp(ts).isoformat()
                ts = os.path.getmtime(config_path)
                updated = datetime.fromtimestamp(ts).isoformat()
            profiles.append({
                "name": name,
                "created": created,
                "updated": updated
            })
    return profiles

@router.get("/{name}")
def get_profile(name: str):
    profile_path = os.path.join(PROFILE_DIR, name)
    config_path = os.path.join(profile_path, "config.json")
    image_path = os.path.join(profile_path, "preview.jpg")

    if not os.path.exists(config_path):
        raise HTTPException(status_code=404, detail="Profile config not found")

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    return {
        "zones": config,
        "image_url": f"/profiles/{name}/preview.jpg"
    }

@router.get("/{name}/preview.jpg")
def get_profile_image(name: str):
    image_path = os.path.join(PROFILE_DIR, name, "preview.jpg")
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path, media_type="image/jpeg")

@router.delete("/{name}")
def delete_profile(name: str):
    profile_path = os.path.join(PROFILE_DIR, name)
    if not os.path.exists(profile_path):
        raise HTTPException(status_code=404, detail="Profile not found")
    shutil.rmtree(profile_path)
    return {"status": "ok", "message": f"Profile '{name}' deleted."}

@router.post("/")
async def save_profile(
    name: str = Form(...),
    zones: str = Form(...),
    image: Optional[UploadFile] = File(None)
):
    profile_path = os.path.join(PROFILE_DIR, name)
    os.makedirs(profile_path, exist_ok=True)

    # Save image if provided
    if image is not None:
        image_path = os.path.join(profile_path, "preview.jpg")
        with open(image_path, "wb") as f:
            content = await image.read()
            f.write(content)

    # Save config.json
    try:
        zone_list = json.loads(zones)
        with open(os.path.join(profile_path, "config.json"), "w", encoding="utf-8") as f:
            json.dump(zone_list, f, indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in zones")

    return {"status": "ok", "message": f"Profile '{name}' saved."}