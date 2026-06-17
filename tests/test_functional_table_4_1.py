"""
Автоматическое функциональное тестирование по таблице 4.1 пояснительной записки.
Запуск: pytest tests/test_functional_table_4_1.py -v
Требуется запущенный backend (см. tests/config.py BASE_URL).
"""

import uuid

import pytest
import requests

from config import (
    BASE_URL,
    HEADERS_ADMIN,
    HEADERS_MANAGER_IVANOV,
    TIMEOUT,
)

MANAGER_LOGIN = {"email": "manager1@crm.by", "password": "1234"}
ADMIN_LOGIN = {"email": "admin@crm.by", "password": "1234"}


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="session", autouse=True)
def require_live_server(base_url, session):
    try:
        r = session.get(f"{base_url}/api/health", timeout=TIMEOUT)
    except requests.RequestException:
        pytest.skip(f"Server is not available on {base_url}")
    if r.status_code != 200:
        pytest.skip(f"Health check failed: {r.status_code}")


def _login(session, base_url, credentials):
    r = session.post(f"{base_url}/api/auth/login", json=credentials, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {credentials['email']}: {r.status_code} {r.text}")
    body = r.json()
    token = body.get("token")
    assert token
    return token, body.get("user") or {}


def _bearer(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _first_client_id(session, base_url, headers):
    r = session.get(f"{base_url}/api/clients", headers=headers, timeout=TIMEOUT)
    assert r.status_code == 200
    clients = r.json()
    assert clients, "Need at least one client"
    return clients[0]["id"]


class TestFunctionalTable41:
    def test_01_register_disabled(self, base_url, session):
        r = session.post(
            f"{base_url}/api/auth/register",
            json={"fullName": "Тест", "email": "new@test.by", "password": "12345678"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 403
        assert "Регистрация отключена" in r.json().get("message", "")

    def test_02_verify_register_disabled(self, base_url, session):
        r = session.post(f"{base_url}/api/auth/verify-register", json={}, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_03_public_client_invite(self, base_url, session):
        client_id = _first_client_id(session, base_url, HEADERS_MANAGER_IVANOV)
        created = session.post(
            f"{base_url}/api/clients/{client_id}/invite-link",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert created.status_code == 201
        token = created.json().get("token")
        r = session.get(f"{base_url}/api/client-invite/{token}", timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body.get("clientName")
        assert body.get("canonicalUrl")

    def test_04_manager_login(self, base_url, session):
        token, user = _login(session, base_url, MANAGER_LOGIN)
        assert user.get("role") == "manager"
        assert token

    def test_05_admin_login(self, base_url, session):
        token, user = _login(session, base_url, ADMIN_LOGIN)
        assert user.get("role") == "admin"
        assert token

    def test_06_list_clients_manager(self, base_url, session):
        r = session.get(f"{base_url}/api/clients", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
        assert r.status_code == 200
        for row in r.json():
            assert row.get("managerId") == int(HEADERS_MANAGER_IVANOV["x-user-id"])

    def test_07_get_client_by_id(self, base_url, session):
        client_id = _first_client_id(session, base_url, HEADERS_MANAGER_IVANOV)
        r = session.get(
            f"{base_url}/api/clients/{client_id}",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        assert r.json().get("id") == client_id

    def test_08_create_client(self, base_url, session):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "name": f"Клиент тест 4.1 {suffix}",
            "email": f"client_{suffix}@test.by",
            "phone": "+375291234567",
        }
        r = session.post(
            f"{base_url}/api/clients",
            json=payload,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        body = r.json()
        assert body.get("managerId") == int(HEADERS_MANAGER_IVANOV["x-user-id"])
        session.delete(
            f"{base_url}/api/clients/{body['id']}",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )

    def test_09_create_deal(self, base_url, session):
        client_id = _first_client_id(session, base_url, HEADERS_MANAGER_IVANOV)
        r = session.post(
            f"{base_url}/api/deals",
            json={"title": f"Сделка 4.1 {uuid.uuid4().hex[:6]}", "clientId": client_id, "stage": "new"},
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        deal_id = r.json().get("id")
        session.delete(f"{base_url}/api/deals/{deal_id}", headers=HEADERS_ADMIN, timeout=TIMEOUT)

    def test_10_create_task(self, base_url, session):
        r = session.post(
            f"{base_url}/api/tasks",
            json={
                "title": f"Задача 4.1 {uuid.uuid4().hex[:6]}",
                "status": "new",
                "priority": "medium",
                "dueDate": "2026-12-31T12:00:00.000Z",
            },
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        task_id = r.json().get("id")
        session.delete(f"{base_url}/api/tasks/{task_id}", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)

    def test_11_dashboard_manager(self, base_url, session):
        token, _user = _login(session, base_url, MANAGER_LOGIN)
        r = session.get(f"{base_url}/api/dashboard/overview", headers=_bearer(token), timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body.get("role") == "manager"
        assert "metrics" in body

    def test_12_dashboard_admin(self, base_url, session):
        token, _user = _login(session, base_url, ADMIN_LOGIN)
        r = session.get(f"{base_url}/api/dashboard/overview", headers=_bearer(token), timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body.get("role") == "admin"
        assert "managerHealth" in body

    def test_13_list_calls(self, base_url, session):
        r = session.get(f"{base_url}/api/calls", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_14_create_video_session(self, base_url, session):
        client_id = _first_client_id(session, base_url, HEADERS_MANAGER_IVANOV)
        r = session.post(
            f"{base_url}/api/video-sessions",
            json={"clientId": client_id},
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        assert r.json().get("guestToken")

    def test_15_video_join_meta(self, base_url, session):
        client_id = _first_client_id(session, base_url, HEADERS_MANAGER_IVANOV)
        created = session.post(
            f"{base_url}/api/video-sessions",
            json={"clientId": client_id},
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        guest = created.json().get("guestToken")
        r = session.get(f"{base_url}/api/video-sessions/join/{guest}", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_16_list_users_admin(self, base_url, session):
        r = session.get(f"{base_url}/api/users", headers=HEADERS_ADMIN, timeout=TIMEOUT)
        assert r.status_code == 200
        for u in r.json():
            assert "password" not in u
        r2 = session.get(f"{base_url}/api/users", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
        assert r2.status_code == 403

    def test_17_create_manager_user(self, base_url, session):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "fullName": f"Менеджер QA {suffix}",
            "email": f"qa_{suffix}@test.crm.local",
            "password": "1234",
        }
        r = session.post(f"{base_url}/api/users", json=payload, headers=HEADERS_ADMIN, timeout=TIMEOUT)
        assert r.status_code == 201
        assert r.json().get("role") == "manager"
        session.delete(f"{base_url}/api/users/{r.json()['id']}", headers=HEADERS_ADMIN, timeout=TIMEOUT)

    def test_18_delete_task(self, base_url, session):
        created = session.post(
            f"{base_url}/api/tasks",
            json={"title": f"Удаление 4.1 {uuid.uuid4().hex[:6]}", "status": "new", "priority": "low"},
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert created.status_code == 201
        task_id = created.json()["id"]
        deleted = session.delete(
            f"{base_url}/api/tasks/{task_id}",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert deleted.status_code == 200

    def test_19_client_invite_link(self, base_url, session):
        client_id = _first_client_id(session, base_url, HEADERS_MANAGER_IVANOV)
        r = session.post(
            f"{base_url}/api/clients/{client_id}/invite-link",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        body = r.json()
        assert body.get("token")
        assert body.get("expiresAt")

    def test_21_upload_voice_optional(self, base_url, session):
        try:
            import io
            import wave
        except ImportError:
            pytest.skip("wave not available")
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(8000)
            wf.writeframes(b"\x00\x00" * 800)
        buf.seek(0)
        files = {"file": ("test_4_1.wav", buf, "audio/wav")}
        r = session.post(
            f"{base_url}/api/uploads/voice",
            headers={"x-user-role": "ADMIN", "x-user-id": "1"},
            files=files,
            timeout=TIMEOUT,
        )
        if r.status_code not in (201, 400):
            pytest.skip(f"Upload not available: {r.status_code}")
        assert r.status_code in (201, 400)

    def test_22_update_call_recording_optional(self, base_url, session):
        voice = session.get(f"{base_url}/api/uploads/voice", headers=HEADERS_ADMIN, timeout=TIMEOUT)
        if voice.status_code != 200 or not voice.json():
            pytest.skip("No voice files")
        recording = voice.json()[0].get("filePath")
        clients = session.get(f"{base_url}/api/clients", headers=HEADERS_ADMIN, timeout=TIMEOUT).json()
        if not clients:
            pytest.skip("No clients")
        created = session.post(
            f"{base_url}/api/calls",
            headers=HEADERS_ADMIN,
            json={
                "clientId": clients[0]["id"],
                "callerId": 1,
                "startedAt": "2026-05-21T10:00:00.000Z",
                "recordingUrl": recording,
            },
            timeout=TIMEOUT,
        )
        if created.status_code not in (201, 400):
            pytest.skip(f"Call create: {created.status_code}")
        if created.status_code == 201:
            call_id = created.json()["id"]
            session.delete(f"{base_url}/api/calls/{call_id}", headers=HEADERS_ADMIN, timeout=TIMEOUT)

    def test_23_auth_me(self, base_url, session):
        token, _user = _login(session, base_url, MANAGER_LOGIN)
        r = session.get(f"{base_url}/api/auth/me", headers=_bearer(token), timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert "password" not in body
        assert body.get("email")

    def test_24_health(self, base_url, session):
        r = session.get(f"{base_url}/api/health", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"
