from datetime import date, timedelta


def create(client, **fields):
    payload = {"title": "Write Dockerfile", **fields}
    response = client.post("/tasks/", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# --- health ---------------------------------------------------------------
def test_health_reports_dependencies(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"] == {"database": "ok", "redis": "disabled"}


def test_liveness_and_readiness(client):
    assert client.get("/health/live").status_code == 200
    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["checks"]["database"] == "ok"


def test_routes_are_available_under_api_prefix(client):
    assert client.get("/api/health").status_code == 200
    create(client)
    assert len(client.get("/api/tasks").json()) == 1


# --- create ---------------------------------------------------------------
def test_create_task_with_defaults(client):
    task = create(client)
    assert task["status"] == "todo"
    assert task["priority"] == "medium"
    assert task["description"] is None
    assert task["created_at"] and task["updated_at"]
    assert task["is_overdue"] is False


def test_create_normalizes_values(client):
    task = create(client, title="  Trim me  ", status="IN_PROGRESS", priority="High")
    assert task["title"] == "Trim me"
    assert task["status"] == "in_progress"
    assert task["priority"] == "high"


def test_create_rejects_invalid_input(client):
    response = client.post("/tasks/", json={"title": "   ", "status": "blocked"})
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Invalid input"
    fields = {error["field"] for error in body["errors"]}
    assert {"title", "status"} <= fields


def test_create_rejects_unknown_owner(client):
    response = client.post("/tasks/", json={"title": "x", "owner_id": 999})
    assert response.status_code == 422


def test_create_without_trailing_slash(client):
    response = client.post("/tasks", json={"title": "No redirect"})
    assert response.status_code == 201


# --- read / list ----------------------------------------------------------
def test_get_task_and_404(client):
    task = create(client)
    assert client.get(f"/tasks/{task['id']}").json()["title"] == task["title"]
    missing = client.get("/tasks/12345")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Task 12345 not found"
    assert client.get("/tasks/abc").status_code == 422


def test_list_filters_search_sort_and_pagination(client):
    create(client, title="Configure Helm chart", priority="high")
    create(client, title="Set up ArgoCD", priority="low", status="done")
    create(client, title="Write Helm values", priority="medium", description="replicas and probes")

    response = client.get("/tasks/", params={"search": "helm"})
    assert response.headers["X-Total-Count"] == "2"

    assert len(client.get("/tasks/", params={"status": "done"}).json()) == 1
    assert len(client.get("/tasks/", params={"search": "probes"}).json()) == 1

    by_priority = client.get("/tasks/", params={"sort": "priority", "order": "desc"}).json()
    assert [task["priority"] for task in by_priority] == ["high", "medium", "low"]

    page = client.get("/tasks/", params={"limit": 2, "offset": 2})
    assert page.headers["X-Total-Count"] == "3"
    assert len(page.json()) == 1


def test_search_treats_wildcards_literally(client):
    create(client, title="100% done")
    create(client, title="Something else")
    assert len(client.get("/tasks/", params={"search": "%"}).json()) == 1
    assert client.get("/tasks/", params={"search": "x" * 101}).status_code == 422


def test_out_of_range_id_is_rejected(client):
    assert client.get("/tasks/99999999999").status_code == 422
    assert client.get("/tasks/0").status_code == 422


def test_overdue_filter(client):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    late = create(client, title="Late", due_date=yesterday)
    create(client, title="Late but done", due_date=yesterday, status="done")
    create(client, title="No due date")

    overdue = client.get("/tasks/", params={"overdue": "true"}).json()
    assert [task["id"] for task in overdue] == [late["id"]]
    assert overdue[0]["is_overdue"] is True


# --- update ---------------------------------------------------------------
def test_partial_update(client):
    task = create(client, description="old")
    response = client.patch(
        f"/tasks/{task['id']}", json={"status": "done", "priority": "low", "description": ""}
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["status"] == "done"
    assert updated["priority"] == "low"
    assert updated["description"] is None
    assert updated["title"] == task["title"]


def test_update_validation(client):
    task = create(client)
    assert client.patch(f"/tasks/{task['id']}", json={}).status_code == 422
    assert client.patch(f"/tasks/{task['id']}", json={"title": None}).status_code == 422
    assert client.patch(f"/tasks/{task['id']}", json={"priority": "urgent"}).status_code == 422
    assert client.patch("/tasks/999", json={"title": "x"}).status_code == 404


# --- delete ---------------------------------------------------------------
def test_delete_task(client):
    task = create(client)
    assert client.delete(f"/tasks/{task['id']}").status_code == 204
    assert client.get(f"/tasks/{task['id']}").status_code == 404
    assert client.delete(f"/tasks/{task['id']}").status_code == 404


# --- stats ----------------------------------------------------------------
def test_stats(client):
    assert client.get("/tasks/stats").json()["total"] == 0

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    create(client, status="done")
    create(client, status="in_progress", due_date=yesterday, priority="high")
    create(client, due_date=tomorrow)
    create(client)

    stats = client.get("/tasks/stats").json()
    assert stats["total"] == 4
    assert stats["by_status"] == {"todo": 2, "in_progress": 1, "done": 1}
    assert stats["by_priority"] == {"low": 0, "medium": 3, "high": 1}
    assert stats["overdue"] == 1
    assert stats["due_soon"] == 1
    assert stats["completion_rate"] == 25.0
