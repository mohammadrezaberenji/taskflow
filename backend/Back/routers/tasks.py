import logging
from datetime import date, timedelta
from enum import Enum
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from .. import cache
from ..database import get_db
from ..models import TASK_PRIORITIES, TASK_STATUSES, Task, User
from ..schemas import (
    TaskCreate,
    TaskPriority,
    TaskResponse,
    TaskStats,
    TaskStatus,
    TaskUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["Tasks"])

TOTAL_COUNT_HEADER = "X-Total-Count"

# PostgreSQL INTEGER range - larger ids would raise a database error instead of a 404
TaskId = Annotated[int, Path(ge=1, le=2_147_483_647, description="Task id")]


class SortField(str, Enum):
    created_at = "created_at"
    updated_at = "updated_at"
    due_date = "due_date"
    priority = "priority"
    status = "status"
    title = "title"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task {task_id} not found")
    return task


def _ensure_owner_exists(db: Session, owner_id: Optional[int]) -> None:
    if owner_id is not None and db.get(User, owner_id) is None:
        raise HTTPException(
            status_code=422,
            detail=f"User {owner_id} does not exist",
        )


def _sort_expression(sort: SortField):
    if sort == SortField.priority:
        return case({"low": 1, "medium": 2, "high": 3}, value=Task.priority, else_=0)
    if sort == SortField.status:
        return case({"todo": 1, "in_progress": 2, "done": 3}, value=Task.status, else_=0)
    if sort == SortField.title:
        return func.lower(Task.title)
    return getattr(Task, sort.value)


@router.get("", response_model=list[TaskResponse], include_in_schema=False)
@router.get("/", response_model=list[TaskResponse])
def get_tasks(
    response: Response,
    search: Optional[str] = Query(None, max_length=100, description="Search in title and description"),
    status_filter: Optional[TaskStatus] = Query(None, alias="status"),
    priority: Optional[TaskPriority] = None,
    overdue: Optional[bool] = Query(None, description="Only tasks past their due date and not done"),
    sort: SortField = SortField.created_at,
    order: SortOrder = SortOrder.desc,
    limit: Optional[int] = Query(None, ge=1, le=100, description="Page size (omit to return all tasks)"),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List tasks. The total number of matching tasks is returned in the X-Total-Count header."""
    params = {
        "search": search,
        "status": status_filter,
        "priority": priority,
        "overdue": overdue,
        "sort": sort,
        "order": order,
        "limit": limit,
        "offset": offset,
        "today": date.today(),
    }
    cache_key = cache.build_key("list", params)
    cached = cache.get_json(cache_key)
    if cached is not None:
        response.headers[TOTAL_COUNT_HEADER] = str(cached["total"])
        return cached["items"]

    query = db.query(Task)
    if search and search.strip():
        # Escape LIKE wildcards so "%" and "_" are matched literally
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        query = query.filter(
            or_(Task.title.ilike(pattern, escape="\\"), Task.description.ilike(pattern, escape="\\"))
        )
    if status_filter:
        query = query.filter(Task.status == status_filter.value)
    if priority:
        query = query.filter(Task.priority == priority.value)
    if overdue is True:
        query = query.filter(Task.due_date < date.today(), Task.status != TaskStatus.done.value)
    elif overdue is False:
        query = query.filter(
            or_(Task.due_date.is_(None), Task.due_date >= date.today(), Task.status == TaskStatus.done.value)
        )

    total = query.count()

    expression = _sort_expression(sort)
    ordering = expression.asc() if order == SortOrder.asc else expression.desc()
    if sort == SortField.due_date:
        ordering = ordering.nulls_last()
    query = query.order_by(ordering, Task.id.desc())
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    items = [TaskResponse.model_validate(task).model_dump(mode="json") for task in query.all()]
    cache.set_json(cache_key, {"total": total, "items": items})

    response.headers[TOTAL_COUNT_HEADER] = str(total)
    return items


@router.get("/stats", response_model=TaskStats)
def get_task_stats(db: Session = Depends(get_db)):
    """Aggregated numbers for the dashboard."""
    today = date.today()
    cache_key = cache.build_key("stats", {"today": today})
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    by_status = {value: 0 for value in TASK_STATUSES}
    for value, count in db.query(Task.status, func.count(Task.id)).group_by(Task.status):
        by_status[value] = count

    by_priority = {value: 0 for value in TASK_PRIORITIES}
    for value, count in db.query(Task.priority, func.count(Task.id)).group_by(Task.priority):
        by_priority[value] = count

    not_done = Task.status != TaskStatus.done.value
    overdue = db.query(func.count(Task.id)).filter(not_done, Task.due_date < today).scalar() or 0
    due_soon = (
        db.query(func.count(Task.id))
        .filter(not_done, Task.due_date >= today, Task.due_date <= today + timedelta(days=7))
        .scalar()
        or 0
    )

    total = sum(by_status.values())
    stats = {
        "total": total,
        "by_status": by_status,
        "by_priority": by_priority,
        "overdue": overdue,
        "due_soon": due_soon,
        "completion_rate": round(by_status["done"] / total * 100, 1) if total else 0.0,
    }
    cache.set_json(cache_key, stats)
    return stats


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    _ensure_owner_exists(db, task.owner_id)
    new_task = Task(
        title=task.title,
        description=task.description,
        status=task.status.value,
        priority=task.priority.value,
        due_date=task.due_date,
        owner_id=task.owner_id,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    cache.invalidate()
    logger.info("Created task id=%s", new_task.id)
    return new_task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: TaskId, db: Session = Depends(get_db)):
    return _get_task_or_404(db, task_id)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: TaskId, changes: TaskUpdate, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    data = changes.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="No fields to update")
    if "owner_id" in data:
        _ensure_owner_exists(db, data["owner_id"])
    for field, value in data.items():
        setattr(task, field, value.value if isinstance(value, Enum) else value)
    db.commit()
    db.refresh(task)
    cache.invalidate()
    logger.info("Updated task id=%s fields=%s", task.id, sorted(data))
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: TaskId, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    db.delete(task)
    db.commit()
    cache.invalidate()
    logger.info("Deleted task id=%s", task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
