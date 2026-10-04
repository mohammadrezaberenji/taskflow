# Directory restructure

## Decision

The initial repository stored both applications under `source code/`. The
repository now uses top-level service directories:

```text
backend/Back/   FastAPI Python package
frontend/       React/Vite application
docs/           Project documentation
```

## Why

- Backend and frontend have independent dependency and container build
  contexts.
- Clear paths simplify CI jobs, Dockerfiles, Helm charts, and ownership.
- Documentation remains separate from application code.

## Compatibility note

The Python package remains named `Back`. It was moved intact rather than
renamed, so its relative imports and existing tests continue to work. Run the
backend from `backend` with `uvicorn Back.main:app`.
