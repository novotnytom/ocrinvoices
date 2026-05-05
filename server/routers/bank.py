import os
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from xml.etree import ElementTree as ET
from typing import List
from typing import Dict
from pathlib import Path

try:
    from path_utils import BATCH_DIR
except ImportError:
    from server.path_utils import BATCH_DIR

router = APIRouter()

BATCH_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/bank/save_batch")
def save_batch(name: str = Body(...), operations: List[dict] = Body(...)):
    path = BATCH_DIR / f"{Path(name).name}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(operations, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "saved_as": name}

@router.delete("/bank/delete_batch")
def delete_batch(name: str):
    path = BATCH_DIR / f"{Path(name).name}.json"
    if path.exists():
        path.unlink()
        return {"status": "deleted", "name": name}
    raise HTTPException(status_code=404, detail="Batch not found")

@router.get("/bank/list_batches")
def list_batches():
    files = [path.stem for path in BATCH_DIR.iterdir() if path.is_file() and path.suffix == ".json"]
    return {"batches": sorted(files)}

@router.get("/bank/load_batch")
def load_batch(name: str):
    path = BATCH_DIR / f"{Path(name).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Batch not found")
    with path.open("r", encoding="utf-8") as f:
        operations = json.load(f)
    return {"operations": operations}

@router.post("/bank/import_xml")
async def import_bank_xml(file: UploadFile = File(...)):
    if not file.filename.endswith(".xml"):
        raise HTTPException(status_code=400, detail="Only XML files allowed.")

    content = await file.read()
    root = ET.fromstring(content)

    entries = []
    for el in root.findall(".//banka"):
        entry = {
            "id": el.findtext("id"),
            "kod": el.findtext("kod"),
            "typPohybuK": el.findtext("typPohybuK"),
            "datVyst": el.findtext("datVyst"),
            "popis": el.findtext("popis"),
            "sumZklCelkem": el.findtext("sumZklCelkem"),
            "buc": el.findtext("buc"),
            "smerKod": el.findtext("smerKod"),
            "banka": el.findtext("banka"),
            "iban": el.findtext("iban"),
            "typDokl": el.findtext("typDokl"),
            "vypisCisDokl": el.findtext("vypisCisDokl"),
            "cisSouhrnne": el.findtext("cisSouhrnne"),
            "varSym": el.findtext("varSym"),
        }
        if entry["id"]:  # Filter out blanks
            entries.append(entry)

    return {"count": len(entries), "operations": entries}

@router.post("/bank/save_match")
def save_match(bank_id: str = Body(...), invoice_id: str = Body(...), batch_name: str = Body(...)):
    path = BATCH_DIR / f"{Path(batch_name).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bank batch not found")

    with path.open("r", encoding="utf-8") as f:
        operations = json.load(f)

    updated = False
    for op in operations:
        if op.get("id") == bank_id:
            op["matched_invoice_id"] = invoice_id
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Bank operation not found")

    with path.open("w", encoding="utf-8") as f:
        json.dump(operations, f, ensure_ascii=False, indent=2)

    return {"status": "ok", "matched": {"bank_id": bank_id, "invoice_id": invoice_id}}

@router.get("/bank/get_match_status")
def get_match_status(bank_id: str, batch_name: str):
    path = BATCH_DIR / f"{Path(batch_name).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bank batch not found")

    with path.open("r", encoding="utf-8") as f:
        operations = json.load(f)

    for op in operations:
        if op.get("id") == bank_id:
            return {"matched_invoice_id": op.get("matched_invoice_id")}

    return {"matched_invoice_id": None}

@router.post("/bank/save_initial_match")
def save_initial_match(
    batch_name: str = Body(...),
    matches: Dict[str, str] = Body(...)
):
    path = BATCH_DIR / f"{Path(batch_name).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bank batch not found")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    updated = False
    for op in data:
        if op["id"] in matches:
            op["initial_match"] = matches[op["id"]]
            updated = True

    if updated:
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return {"status": "ok", "count": len(matches)}

@router.post("/bank/confirm_match")
def confirm_match(
    batch_name: str = Body(...),
    bank_id: str = Body(...),
    invoice_id: str = Body(...)
):
    path = BATCH_DIR / f"{Path(batch_name).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bank batch not found")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    updated = False
    for op in data:
        if op["id"] == bank_id:
            op["initial_match"] = invoice_id
            op["confirm_match"] = True
            updated = True
            break

    if updated:
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"status": "ok", "confirmed": bank_id}
    else:
        raise HTTPException(status_code=404, detail="Bank operation not found")
    
@router.post("/bank/delete_match")
def delete_match(
    batch_name: str = Body(...),
    bank_id: str = Body(...)
):
    path = BATCH_DIR / f"{Path(batch_name).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bank batch not found")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    updated = False
    for op in data:
        if op["id"] == bank_id:
            op["initial_match"] = None
            op["confirm_match"] = False
            updated = True
            break

    if updated:
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"status": "ok", "cleared": bank_id}
    else:
        raise HTTPException(status_code=404, detail="Bank operation not found")
