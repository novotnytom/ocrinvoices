from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ocr, profiles, process_zip, invoice_queue, export_template, overview, backup, converters, bank


app = FastAPI()

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
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
app.include_router(bank.router)
