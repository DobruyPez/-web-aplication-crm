import uuid
import requests
import pytest

from config import BASE_URL, HEADERS_ADMIN, TIMEOUT


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    yield s
    s.close()


def _server_is_alive(base_url, session):
    try:
        response = session.get(f"{base_url}/api/health", timeout=TIMEOUT)
        return response.status_code == 200
    except requests.RequestException:
        return False


def _create_user_payload(suffix, telegram_link=None):
    return {
        "fullName": f"TG Test User {suffix}",
        "email": f"tg_test_{suffix}@example.com",
        "password": "strongPassword123",
        "role": "manager",
        "phone": "+375291112233",
        "telegramLink": telegram_link,
    }


class TestTelegramWebhookAutoLink:
    created_user_ids = []

    def teardown_method(self):
        # best-effort cleanup of users created by tests
        for user_id in self.created_user_ids:
            requests.delete(
                f"{BASE_URL}/api/users/{user_id}",
                headers=HEADERS_ADMIN,
                timeout=TIMEOUT,
            )
        self.created_user_ids = []

    def test_start_command_links_chat_id_by_telegram_link(self, base_url, session):
        if not _server_is_alive(base_url, session):
            pytest.skip("Server is not running on configured BASE_URL")

        suffix = uuid.uuid4().hex[:10]
        payload = _create_user_payload(suffix, telegram_link="https://t.me/tgautotest_id")
        create_resp = session.post(
            f"{base_url}/api/users",
            headers=HEADERS_ADMIN,
            json=payload,
            timeout=TIMEOUT,
        )
        assert create_resp.status_code == 201
        user = create_resp.json()
        self.created_user_ids.append(user["id"])

        chat_id = 987654321
        webhook_payload = {
            "update_id": 10001,
            "message": {
                "message_id": 1,
                "from": {"id": 111, "is_bot": False, "username": "tgautotest_id"},
                "chat": {"id": chat_id, "type": "private"},
                "date": 1710000000,
                "text": "/start",
            },
        }
        webhook_resp = session.post(
            f"{base_url}/api/telegram/webhook",
            json=webhook_payload,
            timeout=TIMEOUT,
        )
        assert webhook_resp.status_code == 200
        body = webhook_resp.json()
        assert body.get("ok") is True
        assert body.get("linked") is True
        assert body.get("via") == "start_telegram_link"

        get_resp = session.get(
            f"{base_url}/api/users/{user['id']}",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )
        assert get_resp.status_code == 200
        updated_user = get_resp.json()
        assert str(updated_user.get("telegramChatId")) == str(chat_id)
        assert updated_user.get("telegramLink") == "https://t.me/tgautotest_id"

    def test_start_command_returns_user_not_found_when_link_absent(self, base_url, session):
        if not _server_is_alive(base_url, session):
            pytest.skip("Server is not running on configured BASE_URL")

        chat_id = 123123123
        webhook_payload = {
            "update_id": 10002,
            "message": {
                "message_id": 2,
                "from": {"id": 6973902802, "is_bot": False, "username": "unknown_user"},
                "chat": {"id": chat_id, "type": "private"},
                "date": 1710000001,
                "text": "/start",
            },
        }
        webhook_resp = session.post(
            f"{base_url}/api/telegram/webhook",
            json=webhook_payload,
            timeout=TIMEOUT,
        )
        assert webhook_resp.status_code == 200
        body = webhook_resp.json()
        assert body.get("ok") is True
        assert body.get("linked") is False
        assert body.get("reason") == "user_not_found_by_link"
