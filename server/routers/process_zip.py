from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import os
import zipfile
import shutil
import uuid
from pathlib import Path
import json

router = APIRouter()

TEMP_DIR = "temp_batches"
PROFILE_DIR = "profiles"

os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/process-zip")
async def process_zip(zip: UploadFile = File(...), profile: str = Form(...)):
    # Check profile exists
    profile_path = os.path.join(PROFILE_DIR, profile)
    config_path = os.path.join(profile_path, "config.json")
    if not os.path.exists(config_path):
        raise HTTPException(status_code=404, detail="Profile not found")

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    # Create unique temp folder
    batch_id = str(uuid.uuid4())
    batch_dir = os.path.join(TEMP_DIR, batch_id)
    os.makedirs(batch_dir, exist_ok=True)

    # Extract ZIP
    zip_path = os.path.join(batch_dir, zip.filename)
    with open(zip_path, "wb") as f:
        content = await zip.read()
        f.write(content)

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(batch_dir)

    os.remove(zip_path)

    # Filter image files
    image_files = sorted([
        f for f in os.listdir(batch_dir)
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
    ])

    pages = []
    for filename in image_files:
        image_url = f"/temp/{batch_id}/{filename}"
        zones = config.copy()
        for zone in zones:
            zone["x"] = int(zone["x"])
            zone["y"] = int(zone["y"])
            zone["width"] = int(zone["width"])
            zone["height"] = int(zone["height"])
        pages.append({
            "filename": filename,
            "imageUrl": image_url,
            "zones": zones,
            "values": {}
        })

    return {"pages": pages}

# Serve images from temp
@router.get("/temp/{batch_id}/{filename}")
def get_temp_image(batch_id: str, filename: str):
    path = os.path.join(TEMP_DIR, batch_id, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type="image/jpeg")
