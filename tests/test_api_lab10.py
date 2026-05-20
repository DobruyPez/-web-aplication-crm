import uuid

import pytest
import requests

from config import (
    BASE_URL,
    HEADERS_ADMIN,
    HEADERS_MANAGER_IVANOV,
    HEADERS_MANAGER_PETROVA,
    TIMEOUT,
)

LAB_TASKS = [
    "1) Проверка доступности API и health-check.",
    "2) Проверка документации/мета-информации API (`GET /api`).",
    "3) Негативный сценарий: отключенная регистрация (`POST /api/auth/register` -> 403).",
    "4) Разграничение доступа: менеджер не может работать с admin-only ресурсом users.",
    "5) Валидация входных данных: создание клиента без обязательного поля `name`.",
    "6) Проверка корректной обработки неверного ID (`400 Invalid id`).",
    "7) Проверка корректной обработки отсутствующей сущности (`404 Client not found`).",
    "8) Сквозной сценарий менеджера: create/read + проверка scope + cleanup.",
]


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
    print("\n=== ЛАБОРАТОРНАЯ: ТЕСТИРОВАНИЕ API ===")
    print(f"Базовый URL: {base_url}")
    print("Задания, покрытые в этом наборе тестов:")
    for task in LAB_TASKS:
        print(f"  - {task}")
    print("=======================================\n")

    try:
        response = session.get(f"{base_url}/api/health", timeout=TIMEOUT)
    except requests.RequestException:
        pytest.skip(f"Server is not available on {base_url}")
    if response.status_code != 200:
        pytest.skip(f"Health check failed with status {response.status_code}")


@pytest.fixture(autouse=True)
def print_test_caption(request):
    print(f"\n[TEST] {request.node.name}")


class TestApiLab10:
    def test_health_endpoint_returns_ok(self, base_url, session):
        print("Шаг: Проверяем, что сервис отвечает по /api/health.")
        response = session.get(f"{base_url}/api/health", timeout=TIMEOUT)
        assert response.status_code == 200
        payload = response.json()
        assert payload.get("status") == "ok"
        print(f"OK: status={payload.get('status')}, code={response.status_code}")

    def test_api_root_contains_docs_and_endpoints(self, base_url, session):
        print("Шаг: Проверяем мета-информацию API на /api.")
        response = session.get(f"{base_url}/api", timeout=TIMEOUT)
        assert response.status_code == 200
        payload = response.json()
        assert payload.get("name")
        assert payload.get("health") == "/api/health"
        assert payload.get("httpBase")
        assert "auth" in payload
        assert payload["auth"].get("login") == "POST /api/auth/login"
        assert payload["auth"].get("me") == "GET /api/auth/me"
        print(f"OK: API name={payload.get('name')}, health={payload.get('health')}")

    def test_auth_register_is_disabled(self, base_url, session):
        print("Шаг: Проверяем запрет публичной регистрации.")
        response = session.post(
            f"{base_url}/api/auth/register",
            json={"email": "test@example.com", "password": "test"},
            timeout=TIMEOUT,
        )
        assert response.status_code == 403
        payload = response.json()
        assert "Регистрация отключена" in payload.get("message", "")
        print(f"OK: регистрация запрещена, code={response.status_code}")

    def test_manager_cannot_access_users_resource(self, base_url, session):
        print("Шаг: Проверяем RBAC — менеджер не должен читать /api/users.")
        response = session.get(
            f"{base_url}/api/users",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT,
        )
        assert response.status_code == 403
        payload = response.json()
        assert "администратора" in payload.get("message", "")
        print(f"OK: доступ менеджера к users заблокирован, code={response.status_code}")

    def test_create_client_without_required_name_fails_validation(self, base_url, session):
        print("Шаг: Проверяем валидацию — создание клиента без name.")
        payload = {"company": "No Name LTD"}
        response = session.post(
            f"{base_url}/api/clients",
            json=payload,
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )
        assert response.status_code == 400
        body = response.json()
        assert "message" in body
        print(f"OK: сервер вернул 400 и сообщение валидации: {body.get('message')}")

    def test_get_client_with_invalid_id_returns_400(self, base_url, session):
        print("Шаг: Проверяем обработку невалидного ID клиента.")
        response = session.get(
            f"{base_url}/api/clients/not-a-number",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )
        assert response.status_code == 400
        assert response.json().get("message") == "Invalid id."
        print("OK: получен ожидаемый ответ 400 Invalid id.")

    def test_get_missing_client_returns_404(self, base_url, session):
        print("Шаг: Проверяем обработку несуществующего клиента.")
        response = session.get(
            f"{base_url}/api/clients/999999999",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )
        assert response.status_code == 404
        assert response.json().get("message") == "Client not found."
        print("OK: получен ожидаемый ответ 404 Client not found.")

    def test_manager_creates_client_in_own_scope(self, base_url, session):
        print("Шаг: Сквозной сценарий менеджера (create/read/scope/cleanup).")
        suffix = uuid.uuid4().hex[:8]
        create_payload = {
            "name": f"LAB10 Manager Client {suffix}",
            "company": "Lab QA",
            "phone": "+375291110000",
            "email": f"lab10_{suffix}@example.com",
            "address": "Minsk",
            "notes": "created by API lab10 test",
            # managerId intentionally omitted; backend must assign it from auth
        }
        created_client_id = None
        try:
            create_response = session.post(
                f"{base_url}/api/clients",
                json=create_payload,
                headers=HEADERS_MANAGER_IVANOV,
                timeout=TIMEOUT,
            )
            assert create_response.status_code == 201
            created = create_response.json()
            created_client_id = created["id"]
            assert created.get("managerId") == int(HEADERS_MANAGER_IVANOV["x-user-id"])
            print(f"OK: менеджер создал клиента id={created_client_id}")

            own_read = session.get(
                f"{base_url}/api/clients/{created_client_id}",
                headers=HEADERS_MANAGER_IVANOV,
                timeout=TIMEOUT,
            )
            assert own_read.status_code == 200
            print("OK: владелец видит своего клиента (200).")

            foreign_read = session.get(
                f"{base_url}/api/clients/{created_client_id}",
                headers=HEADERS_MANAGER_PETROVA,
                timeout=TIMEOUT,
            )
            assert foreign_read.status_code == 404
            print("OK: другой менеджер не видит чужого клиента (404).")
        finally:
            if created_client_id:
                session.delete(
                    f"{base_url}/api/clients/{created_client_id}",
                    headers=HEADERS_ADMIN,
                    timeout=TIMEOUT,
                )
                print(f"Cleanup: тестовый клиент id={created_client_id} удален.")
