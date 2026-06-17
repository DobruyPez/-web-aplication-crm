import pytest
import requests

from config import BASE_URL, HEADERS_MANAGER_IVANOV, TIMEOUT


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


def _first_manager_client(session, base_url):
    r = session.get(f"{base_url}/api/clients", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT)
    assert r.status_code == 200
    return r.json()[0]["id"]


class TestClientInvite:
    def test_manager_generates_invite_link(self, base_url, session):
        client_id = _first_manager_client(session, base_url)
        r = session.post(
            f"{base_url}/api/clients/{client_id}/invite-link",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        body = r.json()
        assert body.get("token")
        assert "/client-invite/" in body.get("url", "")

    def test_public_get_client_invite_without_auth(self, base_url, session):
        client_id = _first_manager_client(session, base_url)
        created = session.post(
            f"{base_url}/api/clients/{client_id}/invite-link",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        token = created.json()["token"]
        r = session.get(f"{base_url}/api/client-invite/{token}", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("clientName")

    def test_video_session_from_pasted_invite_url(self, base_url, session):
        client_id = _first_manager_client(session, base_url)
        created = session.post(
            f"{base_url}/api/clients/{client_id}/invite-link",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        token = created.json()["token"]
        invite_url = f"http://localhost/client-invite/{token}"
        r = session.post(
            f"{base_url}/api/video-sessions",
            headers=HEADERS_MANAGER_IVANOV,
            json={"clientInviteUrl": invite_url},
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        body = r.json()
        assert body.get("direction") == "in"
        assert body.get("clientId") == client_id

    def test_invalid_token_returns_404(self, base_url, session):
        r = session.get(f"{base_url}/api/client-invite/not-a-real-token", timeout=TIMEOUT)
        assert r.status_code == 404

    def test_start_video_from_invite_public(self, base_url, session):
        client_id = _first_manager_client(session, base_url)
        created = session.post(
            f"{base_url}/api/clients/{client_id}/invite-link",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        token = created.json()["token"]
        r = session.post(f"{base_url}/api/client-invite/{token}/start-video", timeout=TIMEOUT)
        assert r.status_code in (200, 201)
        body = r.json()
        assert body.get("joinUrl")
        assert body.get("guestToken")
        assert "/calls/join/" in body.get("joinUrl", "")
