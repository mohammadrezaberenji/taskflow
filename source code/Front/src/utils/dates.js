const DAY_MS = 24 * 60 * 60 * 1000;

// Date-only values ("2026-09-16") are parsed as local dates to avoid timezone shifts
export function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function toDateInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDate(value) {
  const date = parseDateOnly(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysUntil(value, today = new Date()) {
  const date = parseDateOnly(value);
  if (!date) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date - start) / DAY_MS);
}

/** Short human description of a due date, with a tone for styling. */
export function describeDue(dueDate, status, today = new Date()) {
  const days = daysUntil(dueDate, today);
  if (days === null) return { label: "No due date", tone: "muted" };
  if (status === "done") return { label: formatDate(dueDate), tone: "muted" };
  if (days < 0) {
    const overdue = Math.abs(days);
    return { label: `${overdue} day${overdue === 1 ? "" : "s"} overdue`, tone: "danger" };
  }
  if (days === 0) return { label: "Due today", tone: "warning" };
  if (days === 1) return { label: "Due tomorrow", tone: "warning" };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "default" };
  return { label: formatDate(dueDate), tone: "default" };
}
