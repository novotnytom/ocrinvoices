from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
import shutil
from datetime import datetime
from typing import Optional
from PIL import Image

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


def _resolve_template_width(config: dict | list, image_path: str) -> Optional[int]:
    if isinstance(config, dict):
        template_width = config.get("templateWidth")
        if template_width is not None:
            try:
                return int(template_width)
            except (TypeError, ValueError):
                pass

    if os.path.exists(image_path):
        try:
            with Image.open(image_path) as img:
                return int(img.width)
        except OSError:
            return None

    return None

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

    zones = config.get("zones") if isinstance(config, dict) else config
    system_values = config.get("systemValues", {}) if isinstance(config, dict) else {}
    template_width = _resolve_template_width(config, image_path)

    return {
        "name": name,
        "zones": zones,
        "systemValues": system_values,
        "templateWidth": template_width,
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
    systemValues: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None)
):
    profile_path = os.path.join(PROFILE_DIR, name)
    os.makedirs(profile_path, exist_ok=True)
    template_width = None

    # Save image if provided
    if image is not None:
        image_path = os.path.join(profile_path, "preview.jpg")
        content = await image.read()
        with open(image_path, "wb") as f:
            f.write(content)
        try:
            with Image.open(image_path) as saved_image:
                template_width = int(saved_image.width)
        except OSError:
            template_width = None

    # Save config.json
    try:
        zone_list = json.loads(zones)
        system_values = json.loads(systemValues) if systemValues else {}
        existing_config_path = os.path.join(profile_path, "config.json")
        if template_width is None and os.path.exists(existing_config_path):
            with open(existing_config_path, "r", encoding="utf-8") as f:
                existing_config = json.load(f)
            template_width = _resolve_template_width(existing_config, os.path.join(profile_path, "preview.jpg"))

        config = {"zones": zone_list, "systemValues": system_values, "templateWidth": template_width}
        with open(os.path.join(profile_path, "config.json"), "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in zones or systemValues")

    return {"status": "ok", "message": f"Profile '{name}' saved."}
