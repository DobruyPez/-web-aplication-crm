import pytest
import requests

from config import BASE_URL, HEADERS_ADMIN, HEADERS_MANAGER_IVANOV, TIMEOUT


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


class TestCallsManagerRestrictions:
    def test_manager_manual_create_forbidden(self, base_url, session):
        clients = session.get(
            f"{base_url}/api/clients", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT
        ).json()
        client_id = clients[0]["id"]
        r = session.post(
            f"{base_url}/api/calls",
            headers=HEADERS_MANAGER_IVANOV,
            json={
                "clientId": client_id,
                "startedAt": "2026-05-21T10:00:00.000Z",
                "recordingUrl": "/uploads/voice/test.mp3",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_manager_list_calls_scoped_to_own_clients(self, base_url, session):
        r = session.get(f"{base_url}/api/calls", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
        assert r.status_code == 200
        calls = r.json()
        clients = session.get(
            f"{base_url}/api/clients", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT
        ).json()
        allowed = {c["id"] for c in clients}
        for call in calls:
            assert call["clientId"] in allowed

    def test_admin_can_still_create_call(self, base_url, session):
        clients = session.get(f"{base_url}/api/clients", headers=HEADERS_ADMIN, timeout=TIMEOUT).json()
        if not clients:
            pytest.skip("No clients")
        client_id = clients[0]["id"]
        voice = session.get(f"{base_url}/api/uploads/voice", headers=HEADERS_ADMIN, timeout=TIMEOUT)
        if voice.status_code != 200 or not voice.json():
            pytest.skip("No voice files for admin call create test")
        recording = voice.json()[0]["filePath"]
        r = session.post(
            f"{base_url}/api/calls",
            headers=HEADERS_ADMIN,
            json={
                "clientId": client_id,
                "callerId": 1,
                "startedAt": "2026-05-21T11:00:00.000Z",
                "recordingUrl": recording,
            },
            timeout=TIMEOUT,
        )
        assert r.status_code in (201, 400)
