# backend/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Task, User, Trip, TripMember
from schemas.task import TaskCreate, TaskUpdate
from core.deps import get_current_user, check_trip_access
from routers.notifications import create_notification
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.get("")
def get_tasks(
    trip_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(trip_id, current_user.id, ["owner", "editor", "viewer"], db)

    tasks = db.query(Task).filter(
        Task.trip_id == trip_id,
    ).order_by(Task.order_index, Task.created_at).all()

    return {"success": True, "message": "OK", "data": [
        {
            "id":          t.id,
            "title":       t.title,
            "description": t.description,
            "category_id": t.category_id,
            "is_done":     bool(t.is_done),
            "due_date":    str(t.due_date) if t.due_date else None,
            "done_by":     t.done_by,
            "done_at":     str(t.done_at) if t.done_at else None,
            "order_index": t.order_index,
            "created_at":  str(t.created_at),
        }
        for t in tasks
    ]}

@router.post("")
def create_task(
    data:         TaskCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    check_trip_access(data.trip_id, current_user.id, ["owner", "editor"], db)

    max_order = db.query(func.max(Task.order_index)).filter(
        Task.trip_id == data.trip_id
    ).scalar() or 0

    task = Task(
        trip_id     = data.trip_id,
        added_by    = current_user.id,
        title       = data.title,
        description = data.description,
        category_id = data.category_id,
        due_date    = data.due_date,
        order_index = max_order + 1,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {"success": True, "message": "Задача добавлена", "data": {
        "id":          task.id,
        "title":       task.title,
        "is_done":     False,
        "order_index": task.order_index,
    }}

@router.put("/{task_id}")
def update_task(
    task_id:      int,
    data:         TaskUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Задача не найдена")

    check_trip_access(task.trip_id, current_user.id, ["owner", "editor"], db)

    update_data = data.model_dump(exclude_none=True)

    just_completed = False
    if "is_done" in update_data:
        is_done      = update_data.pop("is_done")
        if is_done and not task.is_done:
            just_completed = True
        task.is_done = 1 if is_done else 0
        task.done_by = current_user.id if is_done else None
        task.done_at = datetime.utcnow() if is_done else None

    for field, value in update_data.items():
        setattr(task, field, value)

    if just_completed:
        trip = db.query(Trip).filter(Trip.id == task.trip_id).first()
        member_ids = [
            uid for (uid,) in db.query(TripMember.user_id)
            .filter(TripMember.trip_id == task.trip_id, TripMember.status == "accepted")
            .all()
            if uid != current_user.id
        ]
        for uid in member_ids:
            create_notification(
                db, uid, "task_done",
                title="Задача выполнена",
                message=f"{current_user.name} отметил задачу «{task.title}» как выполненную"
                        + (f" в поездке «{trip.title}»" if trip else ""),
                data={"trip_id": task.trip_id, "task_id": task.id},
            )

    db.commit()

    return {"success": True, "message": "Задача обновлена", "data": {
        "id":      task.id,
        "is_done": bool(task.is_done),
    }}

@router.delete("/{task_id}")
def delete_task(
    task_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Задача не найдена")

    check_trip_access(task.trip_id, current_user.id, ["owner", "editor"], db)

    db.delete(task)
    db.commit()

    return {"success": True, "message": "Задача удалена", "data": {}}