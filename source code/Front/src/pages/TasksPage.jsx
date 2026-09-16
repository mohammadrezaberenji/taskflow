import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { deleteTask, listTasks, updateTask } from "../api/tasks";
import { DueDate, PriorityBadge, StatusBadge } from "../components/Badges";
import ConfirmDialog from "../components/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../components/Feedback";
import Icon from "../components/Icon";
import { PageHeader } from "../components/Layout";
import TaskDetailsModal from "../components/TaskDetailsModal";
import TaskFormModal from "../components/TaskFormModal";
import { useToast } from "../components/Toast";
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  priorityLabel,
  statusLabel,
} from "../constants";
import { useApi } from "../hooks/useApi";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate } from "../utils/dates";

const validValue = (options, value) => (options.some((o) => o.value === value) ? value : "");

function readFilters(searchParams) {
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  return {
    q: searchParams.get("q") || "",
    status: validValue(STATUS_OPTIONS, searchParams.get("status")),
    priority: validValue(PRIORITY_OPTIONS, searchParams.get("priority")),
    overdue: searchParams.get("overdue") === "true",
    sort: validValue(SORT_OPTIONS, searchParams.get("sort")) || DEFAULT_SORT,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function TableSkeleton() {
  return (
    <tbody aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="skeleton-row">
          <td className="col-check">
            <Skeleton width={18} height={18} />
          </td>
          <td>
            <Skeleton width="70%" />
            <Skeleton width="45%" height={10} />
          </td>
          <td><Skeleton width={80} /></td>
          <td><Skeleton width={60} /></td>
          <td><Skeleton width={90} /></td>
          <td><Skeleton width={80} /></td>
          <td><Skeleton width={70} /></td>
        </tr>
      ))}
    </tbody>
  );
}

function Pagination({ page, total, onChange }) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong> tasks
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <Icon name="chevronLeft" size={16} />
          <span className="hide-sm">Previous</span>
        </button>
        <span className="pagination-page">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
        >
          <span className="hide-sm">Next</span>
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </nav>
  );
}

export default function TasksPage() {
  useDocumentTitle("Tasks");
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);

  const [editingTask, setEditingTask] = useState(null); // null = closed, {} = new, task = edit
  const [deletingTask, setDeletingTask] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [detailsVersion, setDetailsVersion] = useState(0);

  const detailsId = searchParams.get("task");
  const createRequested = searchParams.get("new") === "1";

  const updateParams = useCallback(
    (changes, { resetPage = true, replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === "" || value === null || value === undefined || value === false) next.delete(key);
            else next.set(key, String(value));
          });
          if (resetPage) next.delete("page");
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  // Push the debounced search text to the URL (only when the user typed something new)
  const lastSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch === lastSearch.current) return;
    lastSearch.current = debouncedSearch;
    updateParams({ q: debouncedSearch }, { replace: true });
  }, [debouncedSearch, updateParams]);

  // "?new=1" (e.g. from the dashboard) opens the create form
  useEffect(() => {
    if (createRequested) {
      setEditingTask({});
      updateParams({ new: null }, { resetPage: false, replace: true });
    }
  }, [createRequested, updateParams]);

  const { q, status, priority, overdue, sort, page } = filters;
  const loader = useCallback(
    (signal) => {
      const [sortField, order] = sort.split(":");
      return listTasks(
        {
          search: q,
          status,
          priority,
          overdue: overdue || undefined,
          sort: sortField,
          order,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
        signal,
      );
    },
    [q, status, priority, overdue, sort, page],
  );
  const { data, error, loading, initialLoading, reload } = useApi(loader);

  // If the current page became empty (e.g. after deleting), go back one page
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > 1) {
      updateParams({ page: Math.ceil(data.total / PAGE_SIZE) }, { resetPage: false, replace: true });
    }
  }, [data, page, updateParams]);

  const hasFilters = Boolean(q || status || priority || overdue);

  const clearFilters = () => {
    setSearchInput("");
    updateParams({ q: "", status: "", priority: "", overdue: false });
  };

  const openDetails = (task) => updateParams({ task: task.id }, { resetPage: false });
  const closeDetails = () => updateParams({ task: null }, { resetPage: false });

  const handleSaved = (task, isNew) => {
    toast.success(isNew ? `Task "${task.title}" created.` : "Changes saved.");
    setEditingTask(null);
    setDetailsVersion((version) => version + 1);
    reload();
  };

  const handleToggleDone = async (task) => {
    const nextStatus = task.status === "done" ? "todo" : "done";
    setTogglingId(task.id);
    try {
      await updateTask(task.id, { status: nextStatus });
      toast.success(nextStatus === "done" ? `"${task.title}" marked as done.` : `"${task.title}" reopened.`);
      reload();
    } catch (err) {
      toast.error(`Failed to update task. ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    const task = deletingTask;
    try {
      await deleteTask(task.id);
      toast.success(`Task "${task.title}" deleted.`);
      setDeletingTask(null);
      if (String(task.id) === detailsId) closeDetails();
      reload();
    } catch (err) {
      if (err.status === 404) {
        toast.error("This task was already deleted.");
        setDeletingTask(null);
        reload();
      } else {
        toast.error(`Failed to delete task. ${err.message}`);
      }
    }
  };

  const newTaskButton = (
    <button type="button" className="btn btn-primary" onClick={() => setEditingTask({})}>
      <Icon name="plus" size={16} />
      New task
    </button>
  );

  let tableBody;
  if (initialLoading) {
    tableBody = <TableSkeleton />;
  } else if (error && !data) {
    tableBody = null;
  } else {
    tableBody = (
      <tbody>
        {data.items.map((task) => (
          <tr key={task.id} className={task.status === "done" ? "is-done" : ""}>
            <td className="col-check">
              <button
                type="button"
                className={`check-toggle ${task.status === "done" ? "is-checked" : ""}`}
                onClick={() => handleToggleDone(task)}
                disabled={togglingId === task.id}
                aria-label={task.status === "done" ? `Reopen "${task.title}"` : `Mark "${task.title}" as done`}
                title={task.status === "done" ? "Reopen task" : "Mark as done"}
              >
                {togglingId === task.id ? <Spinner size={12} /> : <Icon name="check" size={12} strokeWidth={3} />}
              </button>
            </td>
            <td className="col-title">
              <button type="button" className="task-title-btn" onClick={() => openDetails(task)}>
                {task.title}
              </button>
              {task.description && <p className="task-description">{task.description}</p>}
            </td>
            <td data-label="Status">
              <StatusBadge status={task.status} />
            </td>
            <td data-label="Priority">
              <PriorityBadge priority={task.priority} />
            </td>
            <td data-label="Due date">
              <DueDate dueDate={task.due_date} status={task.status} />
            </td>
            <td data-label="Created" className="text-muted nowrap">
              {formatDate(task.created_at)}
            </td>
            <td className="col-actions">
              <div className="row-actions">
                <button type="button" className="icon-btn" onClick={() => openDetails(task)} aria-label={`View "${task.title}"`} title="View details">
                  <Icon name="eye" size={16} />
                </button>
                <button type="button" className="icon-btn" onClick={() => setEditingTask(task)} aria-label={`Edit "${task.title}"`} title="Edit">
                  <Icon name="edit" size={16} />
                </button>
                <button type="button" className="icon-btn icon-btn-danger" onClick={() => setDeletingTask(task)} aria-label={`Delete "${task.title}"`} title="Delete">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    );
  }

  const showEmpty = data && !error && data.items.length === 0 && data.total === 0;

  return (
    <div className="page">
      <PageHeader title="Tasks" description="Create, organize and track all tasks." actions={newTaskButton} />

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={16} className="search-icon" />
            <input
              type="search"
              className="input search-input"
              placeholder="Search tasks…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search tasks"
              maxLength={100}
            />
          </div>
          <div className="toolbar-filters">
            <select
              className="input select"
              value={status}
              onChange={(event) => updateParams({ status: event.target.value })}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="input select"
              value={priority}
              onChange={(event) => updateParams({ priority: event.target.value })}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="input select"
              value={sort}
              onChange={(event) => updateParams({ sort: event.target.value === DEFAULT_SORT ? "" : event.target.value })}
              aria-label="Sort tasks"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="active-filters">
            {q && <span className="chip">Search: “{q}”</span>}
            {status && <span className="chip">Status: {statusLabel(status)}</span>}
            {priority && <span className="chip">Priority: {priorityLabel(priority)}</span>}
            {overdue && (
              <span className="chip">
                Overdue only
                <button type="button" className="chip-remove" onClick={() => updateParams({ overdue: false })} aria-label="Remove overdue filter">
                  <Icon name="close" size={12} />
                </button>
              </span>
            )}
            <button type="button" className="link link-button" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        {error && !data ? (
          <ErrorState title="Unable to load tasks" error={error} onRetry={reload} />
        ) : showEmpty && !hasFilters ? (
          <EmptyState
            title="No tasks yet"
            message="Create your first task to get started."
            action={newTaskButton}
          />
        ) : showEmpty ? (
          <EmptyState
            icon="search"
            title="No tasks match your filters"
            message="Try a different search term or clear the filters."
            action={
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            {error && (
              <div className="alert alert-error inline-alert" role="alert">
                {error.message}
                <button type="button" className="link link-button" onClick={reload}>
                  Retry
                </button>
              </div>
            )}
            <div className={`table-wrap ${loading && !initialLoading ? "is-refreshing" : ""}`}>
              <table className="task-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <span className="sr-only">Done</span>
                    </th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due date</th>
                    <th>Created</th>
                    <th className="col-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                {tableBody}
              </table>
            </div>
            {data && data.total > 0 && (
              <Pagination
                page={page}
                total={data.total}
                onChange={(nextPage) => updateParams({ page: nextPage > 1 ? nextPage : "" }, { resetPage: false })}
              />
            )}
          </>
        )}
      </div>

      {detailsId && (
        <TaskDetailsModal
          key={`${detailsId}-${detailsVersion}`}
          taskId={detailsId}
          onClose={closeDetails}
          onEdit={(task) => setEditingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onChanged={reload}
        />
      )}

      {editingTask && (
        <TaskFormModal
          task={editingTask.id ? editingTask : null}
          onClose={() => setEditingTask(null)}
          onSaved={handleSaved}
        />
      )}

      {deletingTask && (
        <ConfirmDialog
          title="Delete task?"
          message={
            <>
              <strong>“{deletingTask.title}”</strong> will be permanently deleted. This action cannot be undone.
            </>
          }
          confirmLabel="Delete task"
          onConfirm={handleDelete}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}
