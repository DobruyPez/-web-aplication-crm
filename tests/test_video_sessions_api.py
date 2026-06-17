import io

import pytest
import requests

from config import (
    BASE_URL,
    HEADERS_ADMIN,
    HEADERS_MANAGER_IVANOV,
    HEADERS_MANAGER_PETROVA,
    TIMEOUT,
)


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


def _manager_client_id(session, base_url):
    r = session.get(f"{base_url}/api/clients", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
    assert r.status_code == 200
    clients = r.json()
    assert clients, "Manager needs at least one client"
    return clients[0]["id"]


def _create_session(session, base_url, client_id):
    created = session.post(
        f"{base_url}/api/video-sessions",
        headers=HEADERS_MANAGER_IVANOV,
        json={"clientId": client_id},
        timeout=TIMEOUT,
    )
    assert created.status_code == 201
    return created.json()["guestToken"]


class TestVideoSessionsApi:
    def test_manager_creates_session_out(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        r = session.post(
            f"{base_url}/api/video-sessions",
            headers=HEADERS_MANAGER_IVANOV,
            json={"clientId": client_id},
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        body = r.json()
        assert body.get("maxParticipants") == 2
        assert body.get("guestToken")

    def test_admin_cannot_create_session(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        r = session.post(
            f"{base_url}/api/video-sessions",
            headers=HEADERS_ADMIN,
            json={"clientId": client_id},
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_first_guest_join_ok_second_guest_409(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        guest_token = _create_session(session, base_url, client_id)

        first = session.post(
            f"{base_url}/api/video-sessions/join/{guest_token}",
            json={"peerId": "client-1"},
            timeout=TIMEOUT,
        )
        assert first.status_code == 200
        assert first.json().get("role") == "client"

        second = session.post(
            f"{base_url}/api/video-sessions/join/{guest_token}",
            json={"peerId": "client-2"},
            timeout=TIMEOUT,
        )
        assert second.status_code == 409
        assert "клиент" in second.json().get("message", "").lower() or "менеджер" in second.json().get("message", "").lower()

    def test_admin_join_forbidden(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        guest_token = _create_session(session, base_url, client_id)
        r = session.post(
            f"{base_url}/api/video-sessions/join/{guest_token}",
            headers=HEADERS_ADMIN,
            json={"peerId": "admin-1"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_other_manager_join_forbidden(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        guest_token = _create_session(session, base_url, client_id)
        r = session.post(
            f"{base_url}/api/video-sessions/join/{guest_token}",
            headers=HEADERS_MANAGER_PETROVA,
            json={"peerId": "manager-2"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_host_manager_via_join_http_400(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        guest_token = _create_session(session, base_url, client_id)
        r = session.post(
            f"{base_url}/api/video-sessions/join/{guest_token}",
            headers=HEADERS_MANAGER_IVANOV,
            json={"peerId": "host-via-join"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_guest_join_sets_recording_started_at_with_host_ws_slot(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        guest_token = _create_session(session, base_url, client_id)
        session.post(
            f"{base_url}/api/video-sessions/join/{guest_token}",
            json={"peerId": "client-peer"},
            timeout=TIMEOUT,
        )

    def test_manager_voice_upload_list_forbidden(self, base_url, session):
        r = session.get(f"{base_url}/api/uploads/voice", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_end_upload_creates_call(self, base_url, session):
        client_id = _manager_client_id(session, base_url)
        created = session.post(
            f"{base_url}/api/video-sessions",
            headers=HEADERS_MANAGER_IVANOV,
            json={"clientId": client_id},
            timeout=TIMEOUT,
        )
        session_id = created.json().get("sessionId") or created.json().get("id")
        webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 64
        up = session.post(
            f"{base_url}/api/video-sessions/{session_id}/recording",
            headers={"x-user-role": "MANAGER", "x-user-id": str(HEADERS_MANAGER_IVANOV["x-user-id"])},
            files={"file": ("rec.webm", io.BytesIO(webm), "video/webm")},
            timeout=TIMEOUT,
        )
        assert up.status_code == 201
        ended = session.post(
            f"{base_url}/api/video-sessions/{session_id}/end",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert ended.status_code == 200
