from fastapi import APIRouter
from fastapi.responses import JSONResponse
from zipfile import ZipFile
from pathlib import Path
import datetime

try:
    from path_utils import DATA_DIR, BACKUP_DIR
except ImportError:
    from server.path_utils import DATA_DIR, BACKUP_DIR

router = APIRouter()

@router.post("/backup")
def create_backup():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_path = BACKUP_DIR / f"backup_{timestamp}.zip"

    with ZipFile(zip_path, "w") as zipf:
        for file_path in DATA_DIR.rglob("*"):
            zipf.write(file_path, file_path.relative_to(DATA_DIR))

    return JSONResponse(content={"message": "Backup created", "file": zip_path.name})
