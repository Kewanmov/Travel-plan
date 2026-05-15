import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth, trips, locations, budget, tasks, currencies, invitations, places, admin, public, notifications, attachments, comments

app = FastAPI(title="TravelPlan API", version="1.0.0")

_default_origins = (
    "http://localhost,http://localhost:80,http://localhost:3000,http://localhost:8000,"
    "http://127.0.0.1,http://127.0.0.1:80,http://127.0.0.1:3000,http://127.0.0.1:8000,"
    "http://custom.local,http://custom.local:80,"
    "https://custom.local,https://custom.local:443"
)
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router,        prefix="/api")
app.include_router(trips.router,       prefix="/api")
app.include_router(locations.router,   prefix="/api")
app.include_router(budget.router,      prefix="/api")
app.include_router(tasks.router,       prefix="/api")
app.include_router(currencies.router,  prefix="/api")
app.include_router(invitations.router, prefix="/api")
app.include_router(places.router,      prefix="/api")
app.include_router(admin.router,       prefix="/api")
app.include_router(public.router,      prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(attachments.router,   prefix="/api")
app.include_router(comments.router,      prefix="/api")

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}