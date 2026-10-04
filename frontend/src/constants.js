export const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "due_date:asc", label: "Due date" },
  { value: "priority:desc", label: "Priority" },
  { value: "updated_at:desc", label: "Recently updated" },
  { value: "title:asc", label: "Title (A-Z)" },
];

export const DEFAULT_SORT = SORT_OPTIONS[0].value;
export const PAGE_SIZE = 10;
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;

export const statusLabel = (value) =>
  STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;

export const priorityLabel = (value) =>
  PRIORITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
