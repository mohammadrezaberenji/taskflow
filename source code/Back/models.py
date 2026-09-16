from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base

TASK_STATUSES = ("todo", "in_progress", "done")
TASK_PRIORITIES = ("low", "medium", "high")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # stores a password hash, never plain text

    tasks = relationship("Task", back_populates="owner")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('todo', 'in_progress', 'done')", name="ck_tasks_status"
        ),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_tasks_priority"),
    )

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="todo", index=True)
    priority = Column(String(10), nullable=False, default="medium", index=True)
    due_date = Column(Date, nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    owner = relationship("User", back_populates="tasks")
