from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import Response, StreamingResponse
import json
import uuid
import xml.etree.ElementTree as ET
import base64
import mimetypes
import re
import io
import zipfile
from pathlib import Path

try:
    from path_utils import DATA_DIR, QUEUE_DIR, PROFILE_DIR
except ImportError:
    from server.path_utils import DATA_DIR, QUEUE_DIR, PROFILE_DIR

router = APIRouter()

NUMERIC_TAGS = {
    "sumCelkem", "osv", "sumCelkem_r1", "sumCelkem_r2", "total_value", "mnozMj", "cenaMj"
}

OVERVIEW_DIR = DATA_DIR / "overview"
OVERVIEW_DIR.mkdir(parents=True, exist_ok=True)

class OverviewInvoice(BaseModel):
    id: str
    batch_name: str
    invoice_date: str
    invoice_number: str
    template_used: str
    total_value: float
    accounting_info: Optional[str] = None
    company_id: Optional[str] = None
    selected: bool = True
    order: int
    imageFilename: Optional[str] = None
    systemValues: Optional[dict] = {}

@router.post("/overview/add_batch")
def add_batch(invoices: List[OverviewInvoice]):
    for inv in invoices:
        file_path = OVERVIEW_DIR / f"{Path(inv.id).name}.json"
        with file_path.open('w', encoding="utf-8") as f:
            json.dump(inv.dict(), f)
    return {"status": "Batch added", "count": len(invoices)}

@router.post("/overview/save_invoice")
def save_invoice(invoice: dict):
    uid = invoice.get("id")
    if not uid:
        raise HTTPException(status_code=400, detail="Missing invoice ID")

    path = OVERVIEW_DIR / f"{Path(uid).name}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(invoice, f, indent=2, ensure_ascii=False)
    return {"status": "saved"}

@router.get("/overview/get_invoice")
def get_invoice(id: str = Query(...)):
    path = OVERVIEW_DIR / f"{Path(id).name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Invoice not found")

    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

@router.delete("/overview/delete/{id}")
def delete_invoice(id: str):
    file_path = OVERVIEW_DIR / f"{Path(id).name}.json"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Invoice not found")

    file_path.unlink()
    return {"status": "deleted"}

@router.delete("/overview/delete_all")
def delete_all_invoices():
    if not OVERVIEW_DIR.exists():
        return {"status": "already empty"}

    for path in OVERVIEW_DIR.iterdir():
        if path.is_file() and path.suffix == ".json":
            path.unlink()

    return {"status": "cleared"}

@router.get("/overview/list_invoices", response_model=List[OverviewInvoice])
def list_invoices():
    invoices = []
    for path in OVERVIEW_DIR.iterdir():
        if path.is_file() and path.suffix == ".json":
            with path.open('r', encoding="utf-8") as f:
                data = json.load(f)
                try:
                    data.setdefault("systemValues", {})
                    invoices.append(OverviewInvoice(**data))
                except Exception as e:
                    print(f"Skipping {path.name} due to error: {e}")
    invoices.sort(key=lambda x: x.order)
    return invoices

@router.patch("/overview/update_invoice/{invoice_id}")
def update_invoice(invoice_id: str, updated_fields: dict):
    file_path = OVERVIEW_DIR / f"{Path(invoice_id).name}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Invoice not found")
    with file_path.open('r', encoding="utf-8") as f:
        data = json.load(f)
    data.update(updated_fields)
    with file_path.open('w', encoding="utf-8") as f:
        json.dump(data, f)
    return {"status": "Invoice updated"}

class ExportRequest(BaseModel):
    ids: List[str]

@router.post("/overview/export_selected")
def export_selected(req: ExportRequest):
    root = ET.Element("Invoices")
    for invoice_id in req.ids:
        file_path = OVERVIEW_DIR / f"{Path(invoice_id).name}.json"
        if not file_path.exists():
            continue
        with file_path.open('r', encoding="utf-8") as f:
            data = json.load(f)

        inv_elem = ET.SubElement(root, "Invoice")
        ET.SubElement(inv_elem, "InvoiceNumber").text = data.get("invoice_number")
        ET.SubElement(inv_elem, "InvoiceDate").text = data.get("invoice_date")
        ET.SubElement(inv_elem, "BatchName").text = data.get("batch_name")
        ET.SubElement(inv_elem, "TemplateUsed").text = data.get("template_used")
        ET.SubElement(inv_elem, "TotalValue").text = str(data.get("total_value"))
        ET.SubElement(inv_elem, "AccountingInfo").text = data.get("accounting_info", "")
        ET.SubElement(inv_elem, "CompanyId").text = data.get("company_id", "")

    xml_str = ET.tostring(root, encoding='utf-8')
    return Response(content=xml_str, media_type="application/xml")

def clean_number(value: str) -> str:
    """Clean string that looks like a number (spaces, commas, quotes)."""
    if not isinstance(value, str):
        value = str(value)
    value = value.replace('\xa0', '').replace(' ', '')   # Remove spaces
    value = value.replace(',', '.')                      # Use dot as decimal separator
    value = value.strip('"')                             # Remove surrounding quotes
    return value

def sanitize_xml_tree(root: ET.Element):
    for elem in root.iter():
        tag = elem.tag.split("}")[-1]  # Remove namespace if any
        if tag in NUMERIC_TAGS and elem.text:
            elem.text = clean_number(elem.text)


def build_flexibee_invoice_xml(invoice: dict) -> ET.Element:
    values = dict(invoice.get("values", {}) or {})

    dat_splat = values.get("datSplat", "").strip()
    if not dat_splat or dat_splat == "0":
        dat_vyst = values.get("datVyst")
        if dat_vyst:
            values["datSplat"] = dat_vyst

    items = invoice.get("invoiceItems", [])
    template = invoice.get("template_used", "default")
    invoice_number = invoice.get("invoice_number", "unknown")
    image_filename = invoice.get("imageFilename")

    faktura = ET.Element("faktura-prijata")

    for key, value in values.items():
        ET.SubElement(faktura, key).text = str(value)

    polozky = ET.SubElement(faktura, "polozkyFaktury")
    for item in items:
        polozka = ET.SubElement(polozky, "faktura-prijata-polozka")
        for k, v in item.items():
            ET.SubElement(polozka, k).text = str(v)

    osv_value = values.get("osv")
    if osv_value:
        zaokrouhli = ET.SubElement(faktura, "zaokrouhli")
        ceny = ET.SubElement(zaokrouhli, "pozadovaneCeny")
        ET.SubElement(ceny, "osv").text = str(osv_value)

    if image_filename:
        image_path = QUEUE_DIR / str(invoice.get("batch_name") or "") / Path(image_filename).name
        if image_path.exists():
            with image_path.open("rb") as img_file:
                encoded = base64.b64encode(img_file.read()).decode("utf-8")
            ext = Path(image_filename).suffix.lower()
            content_type = mimetypes.types_map.get(ext, "image/png")
            filename_xml = f"{invoice_number}_{template}{ext}"

            prilohy = ET.SubElement(faktura, "prilohy")
            priloha = ET.SubElement(prilohy, "priloha")
            ET.SubElement(priloha, "nazSoub").text = filename_xml
            ET.SubElement(priloha, "contentType").text = content_type
            ET.SubElement(priloha, "content", attrib={"encoding": "base64"}).text = encoded

    return faktura

@router.post("/overview/export_flexibee")
def export_flexibee(selected_ids: List[str] = Body(...)):
    winstrom = ET.Element("winstrom", attrib={"version": "1.0", "source": "OCRApp"})

    for uid in selected_ids:
        path = OVERVIEW_DIR / f"{Path(uid).name}.json"
        if not path.exists():
            continue

        with path.open("r", encoding="utf-8") as f:
            invoice = json.load(f)
        winstrom.append(build_flexibee_invoice_xml(invoice))

    # 🧼 Sanitize numeric values in-place in XML tree
    sanitize_xml_tree(winstrom)

    # Export as string
    xml_str = ET.tostring(winstrom, encoding="utf-8", method="xml")
    return Response(content=xml_str, media_type="application/xml")


@router.get("/profiles/export/flexibee-examples")
def export_profile_flexibee_examples():
    if not PROFILE_DIR.exists():
        raise HTTPException(status_code=404, detail="No profiles found")

    invoice_candidates: list[dict] = []
    if OVERVIEW_DIR.exists():
        for path in sorted(OVERVIEW_DIR.iterdir()):
            if not path.is_file() or path.suffix != ".json":
                continue
            with path.open("r", encoding="utf-8") as f:
                try:
                    invoice_candidates.append(json.load(f))
                except json.JSONDecodeError:
                    continue

    zip_buffer = io.BytesIO()
    exported_count = 0
    skipped_profiles: list[str] = []

    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for profile_path in sorted(PROFILE_DIR.iterdir()):
            if not profile_path.is_dir():
                continue
            profile_name = profile_path.name

            matched_invoice = next(
                (invoice for invoice in invoice_candidates if invoice.get("template_used") == profile_name),
                None,
            )

            if matched_invoice is None:
                skipped_profiles.append(profile_name)
                continue

            winstrom = ET.Element("winstrom", attrib={"version": "1.0", "source": "OCRApp"})
            winstrom.append(build_flexibee_invoice_xml(matched_invoice))
            sanitize_xml_tree(winstrom)

            xml_bytes = ET.tostring(winstrom, encoding="utf-8", method="xml")
            zip_file.writestr(f"{profile_name}__sample_flexibee.xml", xml_bytes)
            exported_count += 1

        if skipped_profiles:
            skipped_text = "Skipped templates without sample invoice data:\n" + "\n".join(skipped_profiles) + "\n"
            zip_file.writestr("README.txt", skipped_text.encode("utf-8"))

    if exported_count == 0:
        raise HTTPException(status_code=404, detail="No templates with sample invoice data were found")

    zip_buffer.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="flexibee_template_examples.zip"'}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
