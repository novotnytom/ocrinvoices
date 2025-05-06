from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import Response
import os
import json
import uuid
import xml.etree.ElementTree as ET
import base64
import mimetypes

router = APIRouter()

overview_path = "data/overview"
os.makedirs(overview_path, exist_ok=True)

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
        file_path = os.path.join(overview_path, f"{inv.id}.json")
        with open(file_path, 'w') as f:
            json.dump(inv.dict(), f)
    return {"status": "Batch added", "count": len(invoices)}

@router.post("/overview/save_invoice")
def save_invoice(invoice: dict):
    uid = invoice.get("id")
    if not uid:
        raise HTTPException(status_code=400, detail="Missing invoice ID")

    path = os.path.join("data/overview", f"{uid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(invoice, f, indent=2, ensure_ascii=False)
    return {"status": "saved"}

@router.delete("/overview/delete/{id}")
def delete_invoice(id: str):
    file_path = os.path.join(overview_path, f"{id}.json")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Invoice not found")

    os.remove(file_path)
    return {"status": "deleted"}

@router.delete("/overview/delete_all")
def delete_all_invoices():
    if not os.path.exists(overview_path):
        return {"status": "already empty"}

    for filename in os.listdir(overview_path):
        if filename.endswith(".json"):
            os.remove(os.path.join(overview_path, filename))

    return {"status": "cleared"}

@router.get("/overview/list_invoices", response_model=List[OverviewInvoice])
def list_invoices():
    invoices = []
    for filename in os.listdir(overview_path):
        if filename.endswith(".json"):
            with open(os.path.join(overview_path, filename), 'r') as f:
                data = json.load(f)
                try:
                    data.setdefault("systemValues", {})
                    invoices.append(OverviewInvoice(**data))
                except Exception as e:
                    print(f"⚠️ Skipping {filename} due to error: {e}")
    invoices.sort(key=lambda x: x.order)
    return invoices

@router.patch("/overview/update_invoice/{invoice_id}")
def update_invoice(invoice_id: str, updated_fields: dict):
    file_path = os.path.join(overview_path, f"{invoice_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Invoice not found")
    with open(file_path, 'r') as f:
        data = json.load(f)
    data.update(updated_fields)
    with open(file_path, 'w') as f:
        json.dump(data, f)
    return {"status": "Invoice updated"}

class ExportRequest(BaseModel):
    ids: List[str]

@router.post("/overview/export_selected")
def export_selected(req: ExportRequest):
    root = ET.Element("Invoices")
    for invoice_id in req.ids:
        file_path = os.path.join(overview_path, f"{invoice_id}.json")
        if not os.path.exists(file_path):
            continue
        with open(file_path, 'r') as f:
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

@router.post("/overview/export_flexibee")
def export_flexibee(selected_ids: List[str] = Body(...)):
    overview_dir = "data/overview"
    winstrom = ET.Element("winstrom", attrib={"version": "1.0", "source": "OCRApp"})

    for uid in selected_ids:
        path = os.path.join(overview_dir, f"{uid}.json")
        if not os.path.exists(path):
            continue

        with open(path, "r", encoding="utf-8") as f:
            invoice = json.load(f)

        values = invoice.get("values", {})

        # Fallback logic: if datSplat missing/empty/zero, use datVyst
        dat_splat = values.get("datSplat", "").strip()
        if not dat_splat or dat_splat == "0":
            dat_vyst = values.get("datVyst")
            if dat_vyst:
                values["datSplat"] = dat_vyst

        items = invoice.get("invoiceItems", [])
        template = invoice.get("template_used", "default")
        invoice_number = invoice.get("invoice_number", "unknown")
        image_filename = invoice.get("imageFilename")

        faktura = ET.SubElement(winstrom, "faktura-prijata")

        for key, value in values.items():
            ET.SubElement(faktura, key).text = str(value)

        ET.SubElement(faktura, "ucetni").text = "true"
        ET.SubElement(faktura, "zuctovano").text = "true"
        ET.SubElement(faktura, "bezPolozek").text = "false"

        polozky = ET.SubElement(faktura, "polozkyFaktury")
        for item in items:
            polozka = ET.SubElement(polozky, "faktura-prijata-polozka")
            for k, v in item.items():
                ET.SubElement(polozka, k).text = str(v)

        if image_filename:
            queue_dir = f"data/queues/{invoice.get('batch_name')}"
            image_path = os.path.join(queue_dir, image_filename)
            if os.path.exists(image_path):
                with open(image_path, "rb") as img_file:
                    encoded = base64.b64encode(img_file.read()).decode("utf-8")
                ext = os.path.splitext(image_filename)[1].lower()
                content_type = mimetypes.types_map.get(ext, "image/png")
                filename_xml = f"{invoice_number}_{template}{ext}"

                prilohy = ET.SubElement(faktura, "prilohy")
                priloha = ET.SubElement(prilohy, "priloha")
                ET.SubElement(priloha, "nazSoub").text = filename_xml
                ET.SubElement(priloha, "contentType").text = content_type
                ET.SubElement(priloha, "content", attrib={"encoding": "base64"}).text = encoded

    xml_str = ET.tostring(winstrom, encoding="utf-8", method="xml")
    return Response(content=xml_str, media_type="application/xml")

