import { priorityLabel, statusLabel } from "../constants";
import { describeDue } from "../utils/dates";
import Icon from "./Icon";

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-status status-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`priority priority-${priority}`} title={`${priorityLabel(priority)} priority`}>
      <span className="priority-bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {priorityLabel(priority)}
    </span>
  );
}

export function DueDate({ dueDate, status, showIcon = true }) {
  const { label, tone } = describeDue(dueDate, status);
  return (
    <span className={`due due-${tone}`}>
      {showIcon && dueDate && <Icon name={tone === "danger" ? "alert" : "calendar"} size={14} />}
      {label}
    </span>
  );
}
