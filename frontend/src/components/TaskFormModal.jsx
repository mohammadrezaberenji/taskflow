import { useState } from "react";
import { createTask, updateTask } from "../api/tasks";
import {
  DESCRIPTION_MAX_LENGTH,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TITLE_MAX_LENGTH,
} from "../constants";
import { toDateInputValue } from "../utils/dates";
import { toTaskPayload, validateTask } from "../utils/validation";
import { Spinner } from "./Feedback";
import Modal from "./Modal";

const EMPTY_TASK = { title: "", description: "", status: "todo", priority: "medium", due_date: "" };

function initialValues(task) {
  if (!task) return EMPTY_TASK;
  return {
    title: task.title ?? "",
    description: task.description ?? "",
    status: task.status ?? "todo",
    priority: task.priority ?? "medium",
    due_date: task.due_date ?? "",
  };
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  );
}

export default function TaskFormModal({ task, onClose, onSaved }) {
  const isNew = !task;
  const [values, setValues] = useState(() => initialValues(task));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const validationOptions = { isNew, originalDueDate: task?.due_date ?? null };

  const setField = (field, value) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (touched[field] || errors[field]) {
      setErrors((current) => ({ ...current, [field]: validateTask(next, validationOptions)[field] }));
    }
  };

  const handleBlur = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateTask(values, validationOptions)[field] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    const validationErrors = validateTask(values, validationOptions);
    setErrors(validationErrors);
    setTouched({ title: true, description: true, due_date: true });
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = toTaskPayload(values);
      const saved = isNew ? await createTask(payload) : await updateTask(task.id, payload);
      onSaved(saved, isNew);
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(
        `${isNew ? "Failed to create task" : "Failed to save changes"}. ${error.message}`,
      );
      setSubmitting(false);
    }
  };

  const fieldProps = (field) => ({
    id: `task-${field}`,
    "aria-invalid": errors[field] ? "true" : undefined,
    "aria-describedby": errors[field] ? `task-${field}-error` : undefined,
  });

  return (
    <Modal
      title={isNew ? "Create task" : "Edit task"}
      subtitle={isNew ? "Add a new task to your list." : `Task #${task.id}`}
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? "Saving…" : isNew ? "Create task" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="task-form" className="form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <div className="field">
          <label htmlFor="task-title" className="label">
            Title <span className="required" aria-hidden="true">*</span>
          </label>
          <input
            {...fieldProps("title")}
            className="input"
            type="text"
            value={values.title}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="e.g. Configure readiness probe"
            onChange={(event) => setField("title", event.target.value)}
            onBlur={() => handleBlur("title")}
            data-autofocus
            required
          />
          <FieldError id="task-title-error" message={errors.title} />
        </div>

        <div className="field">
          <label htmlFor="task-description" className="label">
            Description
          </label>
          <textarea
            {...fieldProps("description")}
            className="input textarea"
            rows={4}
            value={values.description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Add more details, acceptance criteria or links…"
            onChange={(event) => setField("description", event.target.value)}
            onBlur={() => handleBlur("description")}
          />
          <div className="field-meta">
            <FieldError id="task-description-error" message={errors.description} />
            <span className="char-count">
              {values.description.length}/{DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="task-status" className="label">
              Status
            </label>
            <select
              {...fieldProps("status")}
              className="input select"
              value={values.status}
              onChange={(event) => setField("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError id="task-status-error" message={errors.status} />
          </div>

          <div className="field">
            <label htmlFor="task-due_date" className="label">
              Due date
            </label>
            <input
              {...fieldProps("due_date")}
              className="input"
              type="date"
              value={values.due_date}
              min={isNew ? toDateInputValue() : undefined}
              onChange={(event) => setField("due_date", event.target.value)}
              onBlur={() => handleBlur("due_date")}
            />
            <FieldError id="task-due_date-error" message={errors.due_date} />
          </div>
        </div>

        <fieldset className="field">
          <legend className="label">Priority</legend>
          <div className="segmented" role="radiogroup">
            {PRIORITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`segmented-option priority-option-${option.value} ${
                  values.priority === option.value ? "is-selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={option.value}
                  checked={values.priority === option.value}
                  onChange={() => setField("priority", option.value)}
                />
                <span className="priority-swatch" aria-hidden="true" />
                {option.label}
              </label>
            ))}
          </div>
          <FieldError id="task-priority-error" message={errors.priority} />
        </fieldset>
      </form>
    </Modal>
  );
}
