import { request } from "./client";

export async function listTasks(params, signal) {
  const { data, headers } = await request("/tasks/", { params, signal });
  const total = Number(headers.get("X-Total-Count"));
  return { items: data, total: Number.isFinite(total) && headers.has("X-Total-Count") ? total : data.length };
}

export async function getTaskStats(signal) {
  return (await request("/tasks/stats", { signal })).data;
}

export async function getTask(id, signal) {
  return (await request(`/tasks/${id}`, { signal })).data;
}

export async function createTask(task) {
  return (await request("/tasks/", { method: "POST", body: task })).data;
}

export async function updateTask(id, changes) {
  return (await request(`/tasks/${id}`, { method: "PATCH", body: changes })).data;
}

export async function deleteTask(id) {
  await request(`/tasks/${id}`, { method: "DELETE" });
}

export async function getHealth(signal) {
  return (await request("/health", { signal })).data;
}
