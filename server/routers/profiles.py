from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json
import shutil
from datetime import datetime
from typing import Optional
from PIL import Image
from pathlib import Path

try:
    from path_utils import PROFILE_DIR
except ImportError:
    from server.path_utils import PROFILE_DIR

router = APIRouter()

PROFILE_DIR.mkdir(parents=True, exist_ok=True)


class SystemValuesUpdate(BaseModel):
    systemValues: dict[str, str]

class Zone(BaseModel):
    id: int
    x: int
    y: int
    width: int
    height: int
    propertyName: str


def _load_profile_config(name: str) -> tuple[str, dict | list]:
    profile_path = PROFILE_DIR / name
    config_path = profile_path / "config.json"

    if not config_path.exists():
        raise HTTPException(status_code=404, detail="Profile config not found")

    with config_path.open("r", encoding="utf-8") as f:
        return str(profile_path), json.load(f)


def _normalize_profile_config(config: dict | list, image_path: str) -> dict:
    if isinstance(config, dict):
        zones = config.get("zones", [])
        system_values = config.get("systemValues", {})
        template_width = _resolve_template_width(config, image_path)
    else:
        zones = config
        system_values = {}
        template_width = _resolve_template_width({}, image_path)

    return {
        "zones": zones,
        "systemValues": system_values,
        "templateWidth": template_width,
    }


def _resolve_template_width(config: dict | list, image_path: str) -> Optional[int]:
    if isinstance(config, dict):
        template_width = config.get("templateWidth")
        if template_width is not None:
            try:
                return int(template_width)
            except (TypeError, ValueError):
                pass

    if Path(image_path).exists():
        try:
            with Image.open(image_path) as img:
                return int(img.width)
        except OSError:
            return None

    return None

@router.get("/")
def list_profiles():
    profiles = []
    for path in PROFILE_DIR.iterdir():
        if path.is_dir():
            name = path.name
            created = updated = None
            config_path = path / "config.json"
            if config_path.exists():
                ts = config_path.stat().st_ctime
                created = datetime.fromtimestamp(ts).isoformat()
                ts = config_path.stat().st_mtime
                updated = datetime.fromtimestamp(ts).isoformat()
            profiles.append({
                "name": name,
                "created": created,
                "updated": updated
            })
    return profiles


@router.patch("/{name}/system-values")
def update_profile_system_values(name: str, payload: SystemValuesUpdate):
    profile_path, raw_config = _load_profile_config(name)
    image_path = str(Path(profile_path) / "preview.jpg")
    config = _normalize_profile_config(raw_config, image_path)
    config["systemValues"] = payload.systemValues or {}

    with (Path(profile_path) / "config.json").open("w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    return {"status": "ok", "name": name, "systemValues": config["systemValues"]}

@router.get("/{name}")
def get_profile(name: str):
    profile_path, raw_config = _load_profile_config(name)
    image_path = str(Path(profile_path) / "preview.jpg")
    config = _normalize_profile_config(raw_config, image_path)

    return {
        "name": name,
        "zones": config["zones"],
        "systemValues": config["systemValues"],
        "templateWidth": config["templateWidth"],
        "image_url": f"/profiles/{name}/preview.jpg"
    }

@router.get("/{name}/preview.jpg")
def get_profile_image(name: str):
    image_path = PROFILE_DIR / name / "preview.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path, media_type="image/jpeg")

@router.delete("/{name}")
def delete_profile(name: str):
    profile_path = PROFILE_DIR / name
    if not profile_path.exists():
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
    profile_path = PROFILE_DIR / name
    profile_path.mkdir(parents=True, exist_ok=True)
    template_width = None

    # Save image if provided
    if image is not None:
        image_path = profile_path / "preview.jpg"
        content = await image.read()
        with image_path.open("wb") as f:
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
        existing_config_path = profile_path / "config.json"
        if template_width is None and existing_config_path.exists():
            with existing_config_path.open("r", encoding="utf-8") as f:
                existing_config = json.load(f)
            template_width = _resolve_template_width(existing_config, str(profile_path / "preview.jpg"))

        config = {"zones": zone_list, "systemValues": system_values, "templateWidth": template_width}
        with (profile_path / "config.json").open("w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in zones or systemValues")

    return {"status": "ok", "message": f"Profile '{name}' saved."}
