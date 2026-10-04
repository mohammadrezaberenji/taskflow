import {
  DESCRIPTION_MAX_LENGTH,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TITLE_MAX_LENGTH,
} from "../constants";
import { daysUntil, parseDateOnly } from "./dates";

/**
 * Validates the task form. Returns an object mapping field -> error message
 * (empty object when valid).
 */
export function validateTask(values, { isNew = true, originalDueDate = null } = {}) {
  const errors = {};
  const title = (values.title || "").trim();

  if (!title) errors.title = "Title is required.";
  else if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > TITLE_MAX_LENGTH)
    errors.title = `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`;

  if ((values.description || "").length > DESCRIPTION_MAX_LENGTH)
    errors.description = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;

  if (!STATUS_OPTIONS.some((option) => option.value === values.status))
    errors.status = "Choose a valid status.";

  if (!PRIORITY_OPTIONS.some((option) => option.value === values.priority))
    errors.priority = "Choose a valid priority.";

  if (values.due_date) {
    if (!parseDateOnly(values.due_date)) {
      errors.due_date = "Enter a valid date.";
    } else if (daysUntil(values.due_date) < 0 && (isNew || values.due_date !== originalDueDate)) {
      // Existing tasks may keep a past due date, but a new past date is almost always a mistake
      errors.due_date = "Due date cannot be in the past.";
    }
  }

  return errors;
}

export function toTaskPayload(values) {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    status: values.status,
    priority: values.priority,
    due_date: values.due_date || null,
  };
}
