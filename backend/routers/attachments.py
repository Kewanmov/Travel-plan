import os, secrets, mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Attachment, User, Location, BudgetItem
from core.deps import get_current_user, check_trip_access

router = APIRouter(prefix="/attachments", tags=["attachments"])

UPLOAD_DIR     = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_BYTES      = 8 * 1024 * 1024  # 8 MB
ALLOWED_MIME   = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
}
EXT_BY_MIME    = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/gif": ".gif", "application/pdf": ".pdf",
}


def _serialize(a: Attachment) -> dict:
    return {
        "id":             a.id,
        "trip_id":        a.trip_id,
        "location_id":    a.location_id,
        "budget_item_id": a.budget_item_id,
        "kind":           a.kind,
        "filename":       a.filename,
        "original_name":  a.original_name,
        "mime_type":      a.mime_type,
        "size_bytes":     a.size_bytes,
        "url":            f"/uploads/{a.filename}",
        "created_at":     str(a.created_at) if a.created_at else None,
    }


@router.post("")
async def upload_attachment(
    trip_id:        int  = Form(...),
    location_id:    int | None = Form(None),
    budget_item_id: int | None = Form(None),
    kind:           str  = Form("photo"),
    file:           UploadFile = File(...),
    db:             Session = Depends(get_db),
    current_user:   User    = Depends(get_current_user),
):
    check_trip_access(trip_id, current_user.id, ["owner", "editor"], db)

    if kind not in ("photo", "receipt", "document"):
        kind = "photo"

    if location_id:
        loc = db.query(Location).filter(Location.id == location_id, Location.trip_id == trip_id).first()
        if not loc:
            raise HTTPException(400, "Локация не относится к этой поездке")
    if budget_item_id:
        bi = db.query(BudgetItem).filter(BudgetItem.id == budget_item_id, BudgetItem.trip_id == trip_id).first()
        if not bi:
            raise HTTPException(400, "Расход не относится к этой поездке")

    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(415, f"Тип файла не поддерживается: {mime}")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Пустой файл")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"Файл больше {MAX_BYTES // 1024 // 1024} МБ")

    ext = EXT_BY_MIME.get(mime) or (mimetypes.guess_extension(mime) or ".bin")
    name = secrets.token_urlsafe(20).replace("_", "").replace("-", "") + ext
    path = UPLOAD_DIR / name
    path.write_bytes(data)

    att = Attachment(
        trip_id        = trip_id,
        location_id    = location_id,
        budget_item_id = budget_item_id,
        uploaded_by    = current_user.id,
        kind           = kind,
        filename       = name,
        original_name  = (file.filename or name)[:255],
        mime_type      = mime,
        size_bytes     = len(data),
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    return {"success": True, "message": "Файл загружен", "data": _serialize(att)}


@router.get("")
def list_attachments(
    trip_id:        int | None = Query(None),
    location_id:    int | None = Query(None),
    budget_item_id: int | None = Query(None),
    db:             Session = Depends(get_db),
    current_user:   User    = Depends(get_current_user),
):
    if not (trip_id or location_id or budget_item_id):
        raise HTTPException(400, "Укажите trip_id, location_id или budget_item_id")

    q = db.query(Attachment)
    if location_id:
        q = q.filter(Attachment.location_id == location_id)
    elif budget_item_id:
        q = q.filter(Attachment.budget_item_id == budget_item_id)
    else:
        q = q.filter(Attachment.trip_id == trip_id)

    rows = q.order_by(Attachment.created_at.desc()).all()
    if not rows:
        return {"success": True, "message": "OK", "data": []}

    first_trip = rows[0].trip_id
    check_trip_access(first_trip, current_user.id, ["owner", "editor", "viewer"], db)

    return {"success": True, "message": "OK", "data": [_serialize(r) for r in rows]}


@router.delete("/{att_id}")
def delete_attachment(
    att_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    a = db.query(Attachment).filter(Attachment.id == att_id).first()
    if not a:
        raise HTTPException(404, "Файл не найден")

    check_trip_access(a.trip_id, current_user.id, ["owner", "editor"], db)
    if a.uploaded_by != current_user.id:
        from models import TripMember
        m = db.query(TripMember).filter(
            TripMember.trip_id == a.trip_id,
            TripMember.user_id == current_user.id,
            TripMember.role == "owner",
        ).first()
        if not m:
            raise HTTPException(403, "Удалить может только автор файла или владелец поездки")

    try:
        (UPLOAD_DIR / a.filename).unlink(missing_ok=True)
    except OSError:
        pass

    db.delete(a)
    db.commit()
    return {"success": True, "message": "Файл удалён", "data": {}}