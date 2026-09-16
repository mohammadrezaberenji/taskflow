import { useCallback, useState } from "react";
import { getTask, updateTask } from "../api/tasks";
import { STATUS_OPTIONS } from "../constants";
import { useApi } from "../hooks/useApi";
import { formatDateTime } from "../utils/dates";
import { DueDate, PriorityBadge, StatusBadge } from "./Badges";
import { ErrorState, Skeleton, Spinner } from "./Feedback";
import Icon from "./Icon";
import Modal from "./Modal";
import { useToast } from "./Toast";

export default function TaskDetailsModal({ taskId, onClose, onEdit, onDelete, onChanged }) {
  const toast = useToast();
  const loader = useCallback((signal) => getTask(taskId, signal), [taskId]);
  const { data: task, error, initialLoading, reload } = useApi(loader);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const changeStatus = async (status) => {
    if (!task || status === task.status) return;
    setUpdatingStatus(status);
    try {
      await updateTask(task.id, { status });
      toast.success(`Status changed to "${STATUS_OPTIONS.find((o) => o.value === status).label}".`);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(`Failed to update status. ${err.message}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  let body;
  if (initialLoading) {
    body = (
      <div className="details-loading" aria-busy="true">
        <Skeleton width="60%" height={20} />
        <Skeleton height={14} />
        <Skeleton width="80%" height={14} />
        <Skeleton height={90} />
      </div>
    );
  } else if (error && !task) {
    body = (
      <ErrorState
        title={error.status === 404 ? "Task not found" : "Unable to load task"}
        error={error.status === 404 ? { message: "This task may have been deleted." } : error}
        onRetry={error.status === 404 ? undefined : reload}
      />
    );
  } else if (task) {
    body = (
      <div className="details">
        <div className="details-header">
          <h3 className="details-title">{task.title}</h3>
          <div className="details-badges">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.is_overdue && <span className="badge badge-danger">Overdue</span>}
          </div>
        </div>

        <section className="details-section">
          <h4 className="section-label">Description</h4>
          {task.description ? (
            <p className="details-description">{task.description}</p>
          ) : (
            <p className="text-subtle">No description provided.</p>
          )}
        </section>

        <section className="details-section">
          <h4 className="section-label" id="status-label">
            Status
          </h4>
          <div className="status-switch" role="group" aria-labelledby="status-label">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`status-switch-option status-${option.value} ${
                  task.status === option.value ? "is-selected" : ""
                }`}
                aria-pressed={task.status === option.value}
                disabled={updatingStatus !== null}
                onClick={() => changeStatus(option.value)}
              >
                {updatingStatus === option.value ? <Spinner size={14} /> : <span className="badge-dot" />}
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <dl className="meta-grid">
          <div>
            <dt>Due date</dt>
            <dd>
              <DueDate dueDate={task.due_date} status={task.status} />
            </dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>
              <PriorityBadge priority={task.priority} />
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(task.created_at)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDateTime(task.updated_at)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <Modal
      title="Task details"
      subtitle={task ? `Task #${task.id}` : undefined}
      onClose={onClose}
      size="lg"
      footer={
        task && (
          <>
            <button type="button" className="btn btn-ghost-danger footer-start" onClick={() => onDelete(task)}>
              <Icon name="trash" size={16} />
              Delete
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onEdit(task)}>
              <Icon name="edit" size={16} />
              Edit task
            </button>
          </>
        )
      }
    >
      {body}
    </Modal>
  );
}
