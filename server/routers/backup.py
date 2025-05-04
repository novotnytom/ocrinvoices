from fastapi import APIRouter
from fastapi.responses import JSONResponse
from zipfile import ZipFile
from pathlib import Path
import datetime

router = APIRouter()

@router.post("/backup")
def create_backup():
    data_dir = Path("data")
    backup_dir = Path("backups")
    backup_dir.mkdir(exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_path = backup_dir / f"backup_{timestamp}.zip"

    with ZipFile(zip_path, "w") as zipf:
        for file_path in data_dir.rglob("*"):
            zipf.write(file_path, file_path.relative_to(data_dir))

    return JSONResponse(content={"message": "Backup created", "file": zip_path.name})
