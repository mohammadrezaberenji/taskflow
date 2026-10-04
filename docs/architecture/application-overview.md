# Application overview

TaskFlow has a React/Vite frontend, a FastAPI backend, PostgreSQL for durable
data, and optional Redis caching. The browser uses the frontend's `/api` path;
a reverse proxy forwards that path to the backend.

```text
Browser → Frontend → /api → Backend → PostgreSQL
                                  └→ Redis (optional)
```

Deployment, registry, CI/CD, and Kubernetes details will be documented in
their own workflow and infrastructure documents as they are implemented.
