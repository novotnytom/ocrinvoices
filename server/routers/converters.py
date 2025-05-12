import csv
import io
import os
import re
import tempfile
import zipfile
import requests
import json
from datetime import datetime, timezone, timedelta
import base64
import subprocess

import pandas as pd
import xml.etree.ElementTree as ET
import xml.dom.minidom

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, FileResponse


router = APIRouter()

LOG_FILE = "stripe_invoice_errors.log"

def log_error(message: str):
    with open(LOG_FILE, "a", encoding="utf-8") as log:
        log.write(f"[{datetime.now().isoformat()}] {message}\n")


@router.post("/convert/stripe-bank")
async def convert_stripe_bank(files: list[UploadFile] = File(...)):
    with tempfile.TemporaryDirectory() as tempdir:
        transfers = None
        payments = None

        # Step 1: Read CSV files from upload or ZIP
        for file in files:
            if file.filename.endswith(".zip"):
                zip_bytes = await file.read()
                with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                    for name in zf.namelist():
                        content = zf.read(name).decode("utf-8-sig")
                        if "balance" in name.lower():
                            transfers = list(csv.DictReader(io.StringIO(content)))
                        elif "payments" in name.lower():
                            payments = list(csv.DictReader(io.StringIO(content)))
            elif file.filename.endswith(".csv"):
                content = (await file.read()).decode("utf-8-sig")
                if "balance" in file.filename.lower():
                    transfers = list(csv.DictReader(io.StringIO(content)))
                elif "payments" in file.filename.lower():
                    payments = list(csv.DictReader(io.StringIO(content)))

        if not transfers or not payments:
            raise HTTPException(status_code=400, detail="Both 'payments' and 'balance' files are required.")

        payments_map = {p["id"]: p for p in payments}

        output = io.StringIO()
        writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

        header = [
            "Date", "Time", "TimeZone", "Name", "Type", "Status", "Currency", "Gross", "Fee", "Net",
            "From Email Address", "To Email Address", "Transaction ID", "CounterParty Status",
            "Address Status", "Item Title", "Item ID", "Shipping and Handling Amount", "Insurance Amount",
            "Sales Tax", "Option 1 Name", "Option 1 Value", "Option 2 Name", "Option 2 Value",
            "Auction Site", "Buyer ID", "Item URL", "Closing Date", "Escrow Id", "Reference Txn ID",
            "Invoice Number", "Custom Number", "Receipt ID", "Balance", "Address Line 1",
            "Address Line 2/District/Neighborhood", "Town/City",
            "State/Province/Region/County/Territory/Prefecture/Republic",
            "Zip/Postal Code", "Country", "Contact Phone Number"
        ]
        writer.writerow(header)

        for row in transfers:
            txn_type = row.get("Type", "").strip().lower()
            txn_id = row.get("Source") or row.get("id")
            created = row.get("Created (UTC)")
            currency = row.get("Currency", "")
            gross = float(row.get("Amount", "0").replace(",", "."))
            fee = float(row.get("Fee", "0").replace(",", ".")) if row.get("Fee") else 0.0
            net = float(row.get("Net", "0").replace(",", "."))

            date_part, time_part = created.split(" ")
            date_out = datetime.strptime(date_part, "%Y-%m-%d").strftime("%m/%d/%Y")
            time_out = time_part[:5]

            grossF = f"{gross:.2f}".replace(".", ",")
            feeF = f"{fee:.2f}".replace(".", ",")
            netF = f"{net:.2f}".replace(".", ",")

            customer_email = ""
            status = ""
            buyer_id = ""
            country = ""

            if txn_type == "charge" and txn_id in payments_map:
                p = payments_map[txn_id]
                customer_email = p.get("Customer Email", "")
                status = p.get("Status", "")
                buyer_id = p.get("Customer ID", "")
                country = p.get("Card Issue Country", "")

            writer.writerow([
                date_out, time_out, "GMT+02:00", customer_email, txn_type, status, currency,
                grossF, feeF, netF, "", "", txn_id, "", "", "", "", "", "", "", "", "", "", "",
                buyer_id, "", date_out, "", "", "", "", "", "", "", "", "", "", "", "", country, ""
            ])

        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={
            "Content-Disposition": "attachment; filename=converted_stripe.csv"
        })

@router.post("/convert/zasilkovna")
async def convert_zasilkovna(files: list[UploadFile] = File(...)):
    with tempfile.TemporaryDirectory() as tempdir:
        output_dir = os.path.join(tempdir, "converted")
        os.makedirs(output_dir, exist_ok=True)

        # Step 1: Process uploaded files
        for file in files:
            if file.filename.endswith(".zip"):
                zip_bytes = await file.read()
                with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                    for name in zf.namelist():
                        if name.endswith(".csv"):
                            content = zf.read(name).decode("utf-8-sig")
                            process_zasilkovna_csv(content, name, output_dir)
            elif file.filename.endswith(".csv"):
                content = (await file.read()).decode("utf-8-sig")
                process_zasilkovna_csv(content, file.filename, output_dir)

        # Step 2: Zip all converted files
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zf:
            for fname in os.listdir(output_dir):
                path = os.path.join(output_dir, fname)
                zf.write(path, arcname=fname)

        zip_buffer.seek(0)
        return StreamingResponse(zip_buffer, media_type="application/zip", headers={
            "Content-Disposition": "attachment; filename=converted_zasilkovna.zip"
        })

@router.post("/convert/stripe-invoices")
async def convert_stripe_invoices(files: list[UploadFile] = File(...)):
    
    extracted_csvs = []
    for file in files:
        if file.filename.endswith(".csv"):
            content = (await file.read()).decode("utf-8-sig")
            extracted_csvs.append((file.filename, content))

    if not extracted_csvs:
        raise HTTPException(status_code=400, detail="No valid .csv files found.")

    root = ET.Element('winstrom', version='1.0')
    invoice_counter = 1

    for filename, content in extracted_csvs:
        try:
            rows = list(csv.DictReader(content.splitlines()))
        except Exception as e:
            print(f"Failed to read CSV file {filename}: {e}")
            continue

        for row in rows:
            try:
                required_fields = [
                    "id", "Number", "Date (UTC)", "Amount Due", "Currency", "Status", "Charge",
                    "Customer", "Customer Email", "Customer Address Country", "Finalized At (UTC)"
                ]
                if not all(f in row for f in required_fields):
                    continue

                invoice_date_str = row['Date (UTC)'].split()[0]
                invoice_date = datetime.strptime(invoice_date_str, '%Y-%m-%d')
                invoice_date_iso = invoice_date.strftime('%Y-%m-%d')
                amount_due = row["Amount Due"]
                original_InvNumber = row['Number']
                var_sym = re.sub(r'\D', '', original_InvNumber)

                # Lookup country code from name
                country_name = row.get('Customer Address Country', '').strip()
                country_code = country_name

                payment_method = "Platební brána Stripe (karta)" if row['Charge'] else "PayPal"

                invoice = ET.Element('faktura-vydana')
                ET.SubElement(invoice, "id").text = f"ext:STRIPE-D2C-InvCreate:{invoice_counter}"
                ET.SubElement(invoice, "cisDosle").text = row['Number']
                ET.SubElement(invoice, "varSym").text = var_sym
                ET.SubElement(invoice, "kod").text = f"FP-D2C_{invoice_counter:06d}/23"
                ET.SubElement(invoice, "datVyst").text = invoice_date_iso
                ET.SubElement(invoice, "datSplat").text = invoice_date_iso
                ET.SubElement(invoice, "popis").text = "DRIVE2.CITY Route Planner"
                ET.SubElement(invoice, "poznamka").text = f"Status Stripe: {row['Status']}\nStripe číslo faktury došlé: {row['Number']}"
                ET.SubElement(invoice, "uvodTxt").text = (
                    f"Status Stripe: {row['Status']}\nStripe číslo faktury došlé: {row['Number']}\n"
                    f"Platební metoda: {payment_method}\nIdentifikace platby (Stripe Charge Id): {row['Charge']}"
                )
                ET.SubElement(invoice, "zavTxt").text = f"{filename} / {row['Customer Email']}"
                ET.SubElement(invoice, "sumOsvMen").text = amount_due
                #ET.SubElement(invoice, "sumCelkemMen").text = amount_due
                ET.SubElement(invoice, "nazFirmy").text = row['Customer Email']
                ET.SubElement(invoice, "postovniShodna").text = "true"
                ET.SubElement(invoice, "bezPolozek").text = "true"
                ET.SubElement(invoice, "ucetni").text = "true"
                ET.SubElement(invoice, "zuctovano").text = "true"
                ET.SubElement(invoice, "stitky").text = ""
                ET.SubElement(invoice, "typDokl").text = "code:FAKTURA-PB"
                ET.SubElement(invoice, "mena").text = "code:EUR"
                ET.SubElement(invoice, "stat").text = f"code:{country_code}"
                ET.SubElement(invoice, "formaUhradyCis").text = "code:KARTA"
                ET.SubElement(invoice, "typUcOp").text = "code:TRŽBA SLUŽBY"

                root.append(invoice)
                invoice_counter += 1

            except Exception as e:
                print(f"Error processing row in {filename}: {e}\nRow: {row}")
                continue

    buffer = io.BytesIO()
    tree = ET.ElementTree(root)
    tree.write(buffer, encoding='utf-8', xml_declaration=True)
    buffer.seek(0)

    response = StreamingResponse(buffer, media_type="application/xml")
    response.headers["Content-Disposition"] = "attachment; filename=invoice_export.xml"
    response.headers["X-Invoice-Count"] = str(invoice_counter - 1)
    return response

@router.post("/convert/dph-cz")
async def convert_dph_confirmation(files: list[UploadFile] = File(...)):
   
    invoice_counter = 1
    tempdir = tempfile.mkdtemp()
    output_plain = os.path.join(tempdir, "interni_doklady.xml")
    output_attached = os.path.join(tempdir, "interni_doklady_with_attachments.xml")

    def safe_text(val):
        return str(val).strip() if val else ""

    def decode_hex_xml(p7s_bytes):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".p7s") as f:
            f.write(p7s_bytes)
            f.flush()
            temp_out = f.name + ".xml"
            result = subprocess.run(
                ["openssl", "smime", "-verify", "-in", f.name, "-inform", "DER", "-noverify", "-out", temp_out],
                capture_output=True
            )
            if result.returncode != 0:
                return None
            with open(temp_out, "r", encoding="utf-8") as out:
                return out.read()

    def extract_inner_xml(content: str):
        outer = ET.fromstring(content)
        data_elem = outer.find(".//Data")
        if data_elem is None or not data_elem.text:
            raise ValueError("No <Data> element found in input XML.")
        hex_data = data_elem.text.strip()
        xml_text = bytes.fromhex(hex_data).decode("utf-8")
        return ET.fromstring(xml_text), xml_text

    def build_doklad_xml(root, with_attachments=False, filename=None, original_p7s_content=None, decoded_xml_string=None):
        nonlocal invoice_counter
        winstrom = ET.Element("winstrom", version="1.0")

        for doc in root.findall(".//DPHDP3"):
            vetaD = doc.find("VetaD")
            vetaP = doc.find("VetaP")
            veta6 = doc.find("Veta6")

            rok = safe_text(vetaD.get("rok", "2024"))
            mesic = safe_text(vetaD.get("mesic", "01")).zfill(2)
            castka = safe_text(veta6.get("dan_zocelk", "0"))
            dic = safe_text(vetaP.get("dic", "123456"))
            dat_podani_str = safe_text(vetaD.get("d_poddp", "1.1.2024"))
            podani_date = datetime.strptime(dat_podani_str, '%d.%m.%Y')
            podani_date_iso = podani_date.strftime('%Y-%m-%d')

            doklad = ET.Element("interni-doklad")
            ET.SubElement(doklad, "firma").text = "code:FÚ KRÁLOVÉHRADECKÝ"
            ET.SubElement(doklad, "typDokl").text = "code:INT. DOKLAD"
            ET.SubElement(doklad, "datVyst").text = podani_date_iso
            ET.SubElement(doklad, "cisDosle").text = f"DPH{rok}{mesic}"
            ET.SubElement(doklad, "varSym").text = dic
            ET.SubElement(doklad, "typUcOp").text = "code:DPH IO"
            ET.SubElement(doklad, "popis").text = f"Přiznání k dani z přidané hodnoty ({mesic}/{rok})"

            polozky = ET.SubElement(doklad, "polozkyIntDokladu")
            pol = ET.SubElement(polozky, "interni-doklad-polozka")
            ET.SubElement(pol, "typPolozkyK").text = "typPolozky.ucetni"
            ET.SubElement(pol, "nazev").text = f"Přiznání k DPH (identifikovaná osoba) ({mesic}/{rok})"
            ET.SubElement(pol, "sumOsv").text = castka
            ET.SubElement(pol, "sumCelkem").text = castka

            if with_attachments:
                prilohy = ET.SubElement(doklad, "prilohy")

                # ⬅️ Add original p7s
                if original_p7s_content and filename:
                    encoded_p7s = base64.b64encode(original_p7s_content).decode("utf-8")
                    p = ET.SubElement(prilohy, "priloha")
                    ET.SubElement(p, "nazSoub").text = filename
                    ET.SubElement(p, "contentType").text = "application/pkcs7-signature"
                    content_el = ET.SubElement(p, "content", encoding="base64")
                    content_el.text = encoded_p7s

                # ⬅️ Add decoded XML as attachment
                if decoded_xml_string and filename:
                    encoded_xml = base64.b64encode(decoded_xml_string.encode("utf-8")).decode("utf-8")
                    p = ET.SubElement(prilohy, "priloha")
                    ET.SubElement(p, "nazSoub").text = filename.replace(".p7s", ".decoded.xml")
                    ET.SubElement(p, "contentType").text = "application/xml"
                    content_el = ET.SubElement(p, "content", encoding="base64")
                    content_el.text = encoded_xml

                # ⬅️ Process ObecnaPriloha
                for priloha in root.findall(".//ObecnaPriloha"):
                    fname = safe_text(priloha.get("jm_souboru", "priloha.pdf"))
                    data = priloha.text
                    kodovani = priloha.get("kodovani", "").lower()

                    if not data:
                        continue

                    try:
                        if kodovani == "base64":
                            binary = base64.b64decode(data)
                        else:
                            # Fallback to hex (legacy case or incorrect metadata)
                            binary = bytes.fromhex(data)
                    except Exception as e:
                        print(f"⚠️ Failed to decode attachment {fname}: {e}")
                        continue

                    encoded = base64.b64encode(binary).decode("utf-8")
                    ext = os.path.splitext(fname)[1].lstrip(".").lower()
                    mime = f"application/{ext}" if ext else "application/octet-stream"

                    p = ET.SubElement(prilohy, "priloha")
                    ET.SubElement(p, "nazSoub").text = fname
                    ET.SubElement(p, "contentType").text = mime
                    content_el = ET.SubElement(p, "content", encoding="base64")
                    content_el.text = encoded

            winstrom.append(doklad)
            invoice_counter += 1

        return winstrom

    plain_root = ET.Element("winstrom", version="1.0")
    attached_root = ET.Element("winstrom", version="1.0")

    for file in files:
        try:
            name = file.filename
            raw = await file.read()
            content = decode_hex_xml(raw) if name.endswith(".p7s") else raw.decode("utf-8")
            if not content:
                continue

            # Save original prettified XML
            readable_path = os.path.join(tempdir, f"original__{name.replace('.p7s', '')}.xml")
            try:
                pretty = xml.dom.minidom.parseString(content).toprettyxml(indent="  ")
                with open(readable_path, "w", encoding="utf-8") as f_out:
                    f_out.write(pretty)
            except Exception:
                with open(readable_path, "w", encoding="utf-8") as f_out:
                    f_out.write(content)

            inner_root, decoded_str = extract_inner_xml(content)

            # Save decoded version
            decoded_filename = f"decoded__{name.replace('.p7s', '')}.xml"
            decoded_path = os.path.join(tempdir, decoded_filename)
            with open(decoded_path, "w", encoding="utf-8") as f:
                f.write(xml.dom.minidom.parseString(decoded_str).toprettyxml(indent="  "))

            # Add doklad entries
            for el in build_doklad_xml(inner_root, with_attachments=False):
                plain_root.append(el)
            for el in build_doklad_xml(inner_root, with_attachments=True, filename=name, original_p7s_content=raw, decoded_xml_string=decoded_str):
                attached_root.append(el)

        except Exception as e:
            print(f"Skipping {file.filename}: {e}")
            continue

    # Save both XMLs
    ET.ElementTree(plain_root).write(output_plain, encoding="utf-8", xml_declaration=True)
    ET.ElementTree(attached_root).write(output_attached, encoding="utf-8", xml_declaration=True)

    # Zip it all
    zip_path = os.path.join(tempdir, "converted_dph.zip")
    with zipfile.ZipFile(zip_path, "w") as zipf:
        zipf.write(output_plain, arcname="interni_doklady.xml")
        zipf.write(output_attached, arcname="interni_doklady_with_attachments.xml")

        for fname in os.listdir(tempdir):
            if fname.startswith("decoded__") or fname.startswith("original__"):
                zipf.write(os.path.join(tempdir, fname), arcname=fname)

    return FileResponse(zip_path, filename="converted_dph.zip", media_type="application/zip")


def process_zasilkovna_csv(content: str, original_filename: str, output_dir: str):
    match = re.match(r"(\d{4}-\d{2}-\d{2})__(.+)\.csv", original_filename)
    if not match:
        print(f"Invalid filename: {original_filename}")
        return

    extracted_date = match.group(1)
    reference_id = match.group(2)
    output_filename = f"{extracted_date}__{reference_id}.dobirky@zasilkovna.cz.csv"
    output_path = os.path.join(output_dir, output_filename)

    reader = csv.reader(io.StringIO(content), delimiter=";")
    lines = list(reader)
    if not lines or len(lines[0]) < 32:
        print("Invalid CSV structure")
        return

    data_lines = lines[1:]

    total_fee = 0.0
    total_net = 0.0

    header = [
        "Date", "Time", "TimeZone", "Name", "Type", "Status", "Currency", "Gross", "Fee", "Net",
        "From Email Address", "To Email Address", "Transaction ID", "CounterParty Status",
        "Address Status", "Item Title", "Item ID", "Shipping and Handling Amount", "Insurance Amount",
        "Sales Tax", "Option 1 Name", "Option 1 Value", "Option 2 Name", "Option 2 Value", "Auction Site",
        "Buyer ID", "Item URL", "Closing Date", "Escrow Id", "Reference Txn ID", "Invoice Number",
        "Custom Number", "Receipt ID", "Balance", "Address Line 1", "Address Line 2/District/Neighborhood",
        "Town/City", "State/Province/Region/County/Territory/Prefecture/Republic", "Zip/Postal Code",
        "Country", "Contact Phone Number"
    ]

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    writer.writerow(header)

    for row in data_lines:
        try:
            c0, c1, c2, c3, c4, c5, c6, c7, c8 = (
                row[3], row[4], row[5], row[6], row[10],
                row[11], row[12], row[16], row[30]
            )

            date1 = datetime.strptime(c0, "%Y-%m-%d").strftime("%m/%d/%Y")
            gross = round(float(c6.replace(",", ".").replace(" ", "")), 2)
            fee = round(float(c4.replace(",", ".").replace(" ", "")), 2)
            fee_minus = round(-fee, 2)
            net = round(gross - fee, 2) if gross > 0 else round(-fee, 2)

            if gross <= 0:
                gross = net
                fee_minus = 0.0

            total_fee += fee
            total_net += net

            writer.writerow([
                date1, "00:00", "GMT+02:00", c3, "charge", c7, c5,
                format_decimal(gross), format_decimal(fee_minus), format_decimal(net),
                "", "", reference_id, "", "", "", "", "", "", "", "", "", "", "",
                c3, "", date1, "", "", c1, "", "", "", "", "", "", "", "", "", c8, ""
            ])
        except Exception as e:
            print(f"Skipping row due to error: {e}")
            continue

    if total_net > 0:
        date2 = datetime.strptime(extracted_date, "%Y-%m-%d").strftime("%m/%d/%Y")
        net_payout = round(-total_net, 2)
        writer.writerow([
            date2, "00:00", "GMT+02:00", "Zasilkovna.cz", "payout", "vyplaceno", "CZK",
            format_decimal(net_payout), "0", format_decimal(net_payout),
            "", "", reference_id, "", "", "", "", "", "", "", "", "", "", "",
            c3, "", date2, "", "", reference_id, "", "", "", "", "", "", "", "", "", "CZ", ""
        ])

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output.getvalue())

    return output_filename


def safe_str(value):
    return '' if pd.isna(value) else str(value)
