from pathlib import Path


SERVER_DIR = Path(__file__).resolve().parent
DATA_DIR = SERVER_DIR / "data"
QUEUE_DIR = DATA_DIR / "queues"
PROFILE_DIR = DATA_DIR / "profiles"
EXPORT_TEMPLATE_DIR = DATA_DIR / "export_templates"
BATCH_DIR = DATA_DIR / "bank_batches"
TEMP_DIR = SERVER_DIR / "temp_batches"
BACKUP_DIR = SERVER_DIR / "backups"
