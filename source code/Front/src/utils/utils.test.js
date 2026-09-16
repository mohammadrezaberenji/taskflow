import { describe, expect, it } from "vitest";
import { buildQuery, toApiError } from "../api/client";
import { daysUntil, describeDue, parseDateOnly, toDateInputValue } from "./dates";
import { toTaskPayload, validateTask } from "./validation";

const today = new Date(2026, 8, 16); // 16 Sep 2026
const offset = (days) => toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));

describe("dates", () => {
  it("parses date-only strings as local dates", () => {
    const date = parseDateOnly("2026-09-16");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 16]);
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly("garbage")).toBeNull();
  });

  it("computes days until a date", () => {
    expect(daysUntil(offset(0), today)).toBe(0);
    expect(daysUntil(offset(3), today)).toBe(3);
    expect(daysUntil(offset(-2), today)).toBe(-2);
  });

  it("describes due dates", () => {
    expect(describeDue(null, "todo", today)).toEqual({ label: "No due date", tone: "muted" });
    expect(describeDue(offset(-1), "todo", today)).toEqual({ label: "1 day overdue", tone: "danger" });
    expect(describeDue(offset(-3), "in_progress", today).label).toBe("3 days overdue");
    expect(describeDue(offset(0), "todo", today)).toEqual({ label: "Due today", tone: "warning" });
    expect(describeDue(offset(1), "todo", today).label).toBe("Due tomorrow");
    expect(describeDue(offset(5), "todo", today).label).toBe("Due in 5 days");
    expect(describeDue(offset(-3), "done", today).tone).toBe("muted");
  });
});

describe("validateTask", () => {
  const valid = { title: "Deploy", description: "", status: "todo", priority: "high", due_date: "" };

  it("accepts valid input", () => {
    expect(validateTask(valid)).toEqual({});
  });

  it("rejects missing or short titles", () => {
    expect(validateTask({ ...valid, title: "   " }).title).toBe("Title is required.");
    expect(validateTask({ ...valid, title: "ab" }).title).toMatch(/at least 3/);
    expect(validateTask({ ...valid, title: "x".repeat(201) }).title).toMatch(/200/);
  });

  it("rejects invalid status and priority", () => {
    const errors = validateTask({ ...valid, status: "blocked", priority: "urgent" });
    expect(errors.status).toBeTruthy();
    expect(errors.priority).toBeTruthy();
  });

  it("rejects past due dates for new tasks only", () => {
    const past = "2000-01-01";
    expect(validateTask({ ...valid, due_date: past }).due_date).toMatch(/past/);
    expect(validateTask({ ...valid, due_date: past }, { isNew: false, originalDueDate: past })).toEqual({});
  });

  it("builds a clean payload", () => {
    expect(toTaskPayload({ ...valid, title: "  Deploy  ", description: "  " })).toEqual({
      title: "Deploy",
      description: null,
      status: "todo",
      priority: "high",
      due_date: null,
    });
  });
});

describe("api client helpers", () => {
  it("skips empty query params", () => {
    expect(buildQuery({ search: "", status: "done", limit: 10, overdue: undefined })).toBe("?status=done&limit=10");
    expect(buildQuery({})).toBe("");
  });

  it("maps validation errors to fields", () => {
    const error = toApiError(422, {
      detail: "Invalid input",
      errors: [{ field: "title", message: "Title must not be empty" }],
    });
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ title: "Title must not be empty" });
    expect(error.message).toMatch(/invalid/i);
  });

  it("uses backend detail for client errors but hides server details", () => {
    expect(toApiError(404, { detail: "Task 5 not found" }).message).toBe("Task 5 not found");
    expect(toApiError(500, { detail: "psycopg2 error at host db" }).message).not.toMatch(/psycopg2/);
    expect(toApiError(503, null).message).toMatch(/unavailable/);
    expect(toApiError(500, null).message).toMatch(/unavailable/);
    expect(toApiError(500, { detail: "Internal server error" }).message).toMatch(/went wrong/);
  });
});
