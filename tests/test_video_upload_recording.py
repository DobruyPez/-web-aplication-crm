import io

import pytest
import requests

from config import (
    BASE_URL,
    HEADERS_MANAGER_IVANOV,
    MANAGER_PETROVA_ID,
    TIMEOUT,
)

MINIMAL_WEBM = (
    b"\x1a\x45\xdf\xa3" + b"\x00" * 32
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


class TestVideoUploadRecording:
    def test_webm_upload_only_session_owner(self, base_url, session):
        clients = session.get(
            f"{base_url}/api/clients", headers=HEADERS_MANAGER_IVANOV, timeout=TIMEOUT
        ).json()
        client_id = clients[0]["id"]
        created = session.post(
            f"{base_url}/api/video-sessions",
            headers=HEADERS_MANAGER_IVANOV,
            json={"clientId": client_id},
            timeout=TIMEOUT,
        )
        assert created.status_code == 201
        session_id = created.json().get("sessionId") or created.json().get("id")

        files = {"file": ("test.webm", io.BytesIO(MINIMAL_WEBM), "video/webm")}
        ok = session.post(
            f"{base_url}/api/video-sessions/{session_id}/recording",
            headers={"x-user-role": "MANAGER", "x-user-id": "2"},
            files=files,
            timeout=TIMEOUT,
        )
        assert ok.status_code == 201

        forbidden = session.post(
            f"{base_url}/api/video-sessions/{session_id}/recording",
            headers={
                "x-user-role": "MANAGER",
                "x-user-id": str(MANAGER_PETROVA_ID),
            },
            files={"file": ("x.webm", io.BytesIO(MINIMAL_WEBM), "video/webm")},
            timeout=TIMEOUT,
        )
        assert forbidden.status_code == 403
