# routers/convert_zasilkovna.py

import csv
import io
import os
import re
import tempfile
import zipfile
from datetime import datetime
from typing import List

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse

router = APIRouter()


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


def format_decimal(value: float) -> str:
    """Convert float to string with comma as decimal separator."""
    return f"{value:.2f}".replace(".", ",")


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