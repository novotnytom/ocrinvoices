from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ocr, profiles, process_zip, invoice_queue, export_template, overview, backup, converters


app = FastAPI()

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(ocr.router, prefix="/ocr", tags=["OCR"]),
app.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
app.include_router(process_zip.router)
app.include_router(invoice_queue.router)
app.include_router(export_template.router, prefix="/export-template", tags=["Export Template"])
app.include_router(overview.router)
app.include_router(backup.router)
app.include_router(converters.router)
