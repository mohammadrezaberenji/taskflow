from datetime import date, datetime
from enum import Enum
from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, computed_field, field_validator


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


def _normalize_choice(value):
    # Accept "TODO", "In Progress", "in-progress"... and store the canonical value
    if isinstance(value, str):
        return value.strip().lower().replace("-", "_").replace(" ", "_")
    return value


def _clean_title(value):
    if isinstance(value, str):
        value = value.strip()
        if not value:
            raise ValueError("Title must not be empty")
    return value


def _clean_description(value):
    if isinstance(value, str):
        return value.strip() or None
    return value


Title = Annotated[str, BeforeValidator(_clean_title), Field(min_length=1, max_length=200)]
Description = Annotated[
    Optional[Annotated[str, Field(max_length=5000)]], BeforeValidator(_clean_description)
]
Status = Annotated[TaskStatus, BeforeValidator(_normalize_choice)]
Priority = Annotated[TaskPriority, BeforeValidator(_normalize_choice)]
OwnerId = Annotated[Optional[int], Field(gt=0)]


class TaskCreate(BaseModel):
    title: Title
    description: Description = None
    status: Status = TaskStatus.todo
    priority: Priority = TaskPriority.medium
    due_date: Optional[date] = None
    owner_id: OwnerId = None


class TaskUpdate(BaseModel):
    """Partial update - only the fields that are sent are changed."""

    title: Optional[Title] = None
    description: Description = None
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    due_date: Optional[date] = None
    owner_id: OwnerId = None

    @field_validator("title", "status", "priority")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    owner_id: Optional[int] = None

    @computed_field
    @property
    def is_overdue(self) -> bool:
        return (
            self.due_date is not None
            and self.status != TaskStatus.done.value
            and self.due_date < date.today()
        )


class TaskStats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    overdue: int
    due_soon: int
    completion_rate: float


class HealthChecks(BaseModel):
    database: str
    redis: str


class HealthResponse(BaseModel):
    status: str
    version: str
    instance: str
    checks: Optional[HealthChecks] = None
