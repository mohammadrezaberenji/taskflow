// Thin fetch wrapper: timeouts, JSON handling and user-friendly error messages.

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const DEFAULT_MESSAGES = {
  400: "The request could not be processed.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested item could not be found.",
  409: "This change conflicts with existing data.",
  422: "Some fields are invalid. Please check your input.",
  500: "Something went wrong on the server. Please try again.",
  502: "The server is unavailable right now. Please try again shortly.",
  503: "The server is unavailable right now. Please try again shortly.",
  504: "The server took too long to respond. Please try again.",
};

export function messageForStatus(status) {
  if (DEFAULT_MESSAGES[status]) return DEFAULT_MESSAGES[status];
  return status >= 500 ? DEFAULT_MESSAGES[500] : DEFAULT_MESSAGES[400];
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

// Converts the backend error body into an ApiError
export function toApiError(status, body) {
  const fieldErrors = {};
  if (body && Array.isArray(body.errors)) {
    body.errors.forEach(({ field, message }) => {
      if (field && !fieldErrors[field]) fieldErrors[field] = message;
    });
  }
  // A 5xx without our JSON body comes from the reverse proxy: the backend is down
  let message = status >= 500 && !body ? DEFAULT_MESSAGES[503] : messageForStatus(status);
  // Only surface backend "detail" messages for client errors; 5xx details stay generic
  if (status < 500 && body && typeof body.detail === "string" && body.detail !== "Invalid input") {
    message = body.detail;
  }
  return new ApiError(message, { status, fieldErrors });
}

export async function request(path, { method = "GET", body, params, signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(params)}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // cancelled by the caller - not a failure
    if (timedOut) throw new ApiError(DEFAULT_MESSAGES[504], { status: 0 });
    throw new ApiError("Unable to reach the server. Check your connection and try again.", {
      status: 0,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 204) return { data: null, headers: response.headers };

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) throw toApiError(response.status, data);
  return { data, headers: response.headers };
}
