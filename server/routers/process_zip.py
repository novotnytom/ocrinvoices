from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pdf2image import convert_from_bytes
from PIL import Image
import mimetypes
import os
import zipfile
import uuid
import json

router = APIRouter()

TEMP_DIR = "temp_batches"
PROFILE_DIR = "data/profiles"

os.makedirs(TEMP_DIR, exist_ok=True)

def _load_profile(profile: str):
    profile_path = os.path.join(PROFILE_DIR, profile)
    config_path = os.path.join(profile_path, "config.json")
    if not os.path.exists(config_path):
        raise HTTPException(status_code=404, detail="Profile not found")

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    if isinstance(config, dict):
        zones = config.get("zones", [])
        template_width = config.get("templateWidth")
    else:
        zones = config
        template_width = None

    zones = [dict(z) for z in zones]
    for zone in zones:
        zone["x"] = int(zone["x"])
        zone["y"] = int(zone["y"])
        zone["width"] = int(zone["width"])
        zone["height"] = int(zone["height"])

    if template_width is None:
        image_path = os.path.join(profile_path, "preview.jpg")
        if os.path.exists(image_path):
            try:
                with Image.open(image_path) as img:
                    template_width = int(img.width)
            except OSError:
                template_width = None

    if template_width is not None:
        try:
            template_width = int(template_width)
        except (TypeError, ValueError):
            template_width = None

    return {
        "zones": zones,
        "templateWidth": template_width,
    }

def _create_batch_dir() -> tuple[str, str]:
    batch_id = str(uuid.uuid4())
    batch_dir = os.path.join(TEMP_DIR, batch_id)
    os.makedirs(batch_dir, exist_ok=True)
    return batch_id, batch_dir

def _build_page_payload(
    batch_id: str,
    filename: str,
    zones: list[dict],
    document_width: int,
    template_width: int | None,
):
    return {
        "filename": filename,
        "imageUrl": f"/temp/{batch_id}/{filename}",
        "zones": [dict(z) for z in zones],
        "values": {},
        "documentWidth": int(document_width),
        "templateWidth": int(template_width) if template_width is not None else None,
        "pageScaleMultiplier": 1.0,
    }

def _is_supported_image(filename: str, content_type: str | None) -> bool:
    normalized_type = (content_type or "").lower()
    return normalized_type.startswith("image/") or filename.lower().endswith((".jpg", ".jpeg", ".png"))

@router.post("/process-zip")
async def process_zip(zip: UploadFile = File(...), profile: str = Form(...)):
    # Check profile exists
    profile_data = _load_profile(profile)
    zones = profile_data["zones"]
    template_width = profile_data["templateWidth"]

    # Create unique temp folder
    batch_id, batch_dir = _create_batch_dir()

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
        page_zones = [dict(z) for z in zones]
        image_path = os.path.join(batch_dir, filename)
        try:
            with Image.open(image_path) as page_image:
                document_width = int(page_image.width)
        except OSError:
            continue
        pages.append({
            "filename": filename,
            "imageUrl": image_url,
            "zones": page_zones,
            "values": {},
            "documentWidth": document_width,
            "templateWidth": int(template_width) if template_width is not None else None,
            "pageScaleMultiplier": 1.0,
        })

    return {"pages": pages}

@router.post("/process-image")
async def process_image(image: UploadFile = File(...), profile: str = Form(...)):
    profile_data = _load_profile(profile)
    zones = profile_data["zones"]
    template_width = profile_data["templateWidth"]

    batch_id, batch_dir = _create_batch_dir()

    filename = image.filename or f"{uuid.uuid4()}.jpg"
    content = await image.read()
    is_pdf = (image.content_type or "").lower() == "application/pdf" or filename.lower().endswith(".pdf")

    if not is_pdf and not _is_supported_image(filename, image.content_type):
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload JPG, JPEG, PNG, or PDF.")

    if is_pdf:
        base_name = os.path.splitext(os.path.basename(filename))[0] or str(uuid.uuid4())
        pdf_pages = convert_from_bytes(content, fmt="png")
        if not pdf_pages:
            raise HTTPException(status_code=400, detail="The uploaded PDF did not contain any pages.")
        pages = []

        for index, page_image in enumerate(pdf_pages, start=1):
            page_filename = f"{base_name}_page_{index:03d}.png"
            page_path = os.path.join(batch_dir, page_filename)
            page_image.save(page_path, "PNG")
            pages.append(_build_page_payload(batch_id, page_filename, zones, page_image.width, template_width))

        return {"pages": pages}

    image_path = os.path.join(batch_dir, filename)
    with open(image_path, "wb") as f:
        f.write(content)

    try:
        with Image.open(image_path) as uploaded_image:
            document_width = int(uploaded_image.width)
    except OSError:
        raise HTTPException(status_code=400, detail="Unable to read uploaded image dimensions.")

    return {"pages": [_build_page_payload(batch_id, filename, zones, document_width, template_width)]}

# Serve images from temp
@router.get("/temp/{batch_id}/{filename}")
def get_temp_image(batch_id: str, filename: str):
    path = os.path.join(TEMP_DIR, batch_id, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    media_type, _ = mimetypes.guess_type(path)
    return FileResponse(path, media_type=media_type or "application/octet-stream")
