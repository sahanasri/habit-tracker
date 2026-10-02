import os

os.environ["DATABASE_URL"] = "sqlite:///./test_habit_tracker.db"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module():
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_habit_tracker.db"):
        os.remove("test_habit_tracker.db")


def auth_headers(client: TestClient, email: str = "student@example.com") -> dict[str, str]:
    response = client.post(
        "/api/auth/register", json={"name": "Study User", "email": email, "password": "practice123"}
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Study User"
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_create_toggle_and_dashboard():
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post(
            "/api/habits",
            json={"name": "Read", "description": "Twenty pages", "target_days_per_week": 5},
            headers=headers,
        )
        assert created.status_code == 201
        habit_id = created.json()["id"]

        toggled = client.post(f"/api/habits/{habit_id}/toggle?date=2026-09-03", headers=headers)
        assert toggled.status_code == 200
        assert toggled.json()["completed_today"] is True

        dashboard = client.get("/api/dashboard?date=2026-09-03", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["completed_count"] == 1
        assert dashboard.json()["completion_rate"] == 1


def test_notes_and_delete():
    with TestClient(app) as client:
        headers = auth_headers(client)
        habit_id = client.post("/api/habits", json={"name": "Walk"}, headers=headers).json()["id"]
        note = client.post(
            f"/api/habits/{habit_id}/notes",
            json={"noted_on": "2026-09-03", "body": "Long route"},
            headers=headers,
        )
        assert note.status_code == 201
        assert len(client.get(f"/api/habits/{habit_id}/notes", headers=headers).json()) == 1
        assert client.delete(f"/api/habits/{habit_id}", headers=headers).status_code == 204


def test_login_required_and_accounts_are_isolated():
    with TestClient(app) as client:
        first_headers = auth_headers(client, "first@example.com")
        habit_id = client.post("/api/habits", json={"name": "Private"}, headers=first_headers).json()["id"]

        assert client.get("/api/dashboard").status_code == 401
        second_headers = auth_headers(client, "second@example.com")
        assert client.get("/api/dashboard", headers=second_headers).json()["habits"] == []
        assert client.delete(f"/api/habits/{habit_id}", headers=second_headers).status_code == 404

        login = client.post(
            "/api/auth/login",
            json={"email": "FIRST@example.com", "password": "practice123"},
        )
        assert login.status_code == 200
        assert login.json()["name"] == "Study User"
        assert login.json()["email"] == "first@example.com"
        profile = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {login.json()['token']}"},
        )
        assert profile.json() == {"name": "Study User", "email": "first@example.com"}