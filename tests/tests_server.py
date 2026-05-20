from unittest.mock import Mock

import pytest
import requests


def _handle_response(response):
    """Преобразует HTTP-ответ в payload или выбрасывает исключение."""
    if response.status_code >= 400:
        message = "HTTP error"
        try:
            payload = response.json()
            message = payload.get("error", message)
        except ValueError:
            message = response.text or message
        raise RuntimeError(message)
    return response.json()


def fetch_users(session, base_url):
    response = session.get(f"{base_url}/admin/users", timeout=5)
    return _handle_response(response)


def create_client(session, base_url, client_data):
    response = session.post(f"{base_url}/admin/clients", json=client_data, timeout=5)
    return _handle_response(response)


def delete_user(session, base_url, user_id):
    response = session.delete(f"{base_url}/admin/users/{user_id}", timeout=5)
    return _handle_response(response)


def manager_update_client(session, base_url, manager_id, client_id, update_data):
    response = session.put(
        f"{base_url}/manager/{manager_id}/clients/{client_id}",
        json=update_data,
        timeout=5,
    )
    return _handle_response(response)


@pytest.fixture
def base_url():
    return "http://localhost:3000"


@pytest.fixture
def session_stub():
    return Mock(spec=requests.Session)


def test_handle_response_returns_json_for_success_status():
    response = Mock()
    response.status_code = 200
    response.json.return_value = {"ok": True}

    result = _handle_response(response)

    assert result == {"ok": True}


def test_handle_response_raises_runtime_error_with_api_message():
    response = Mock()
    response.status_code = 404
    response.json.return_value = {"error": "Пользователь не найден"}

    with pytest.raises(RuntimeError, match="Пользователь не найден"):
        _handle_response(response)


def test_handle_response_uses_text_when_json_invalid():
    response = Mock()
    response.status_code = 500
    response.json.side_effect = ValueError("invalid json")
    response.text = "Internal server error"

    with pytest.raises(RuntimeError, match="Internal server error"):
        _handle_response(response)


def test_fetch_users_calls_expected_endpoint(session_stub, base_url):
    session_stub.get.return_value = Mock(
        status_code=200, json=Mock(return_value=[{"id": 1, "full_name": "Admin"}])
    )

    result = fetch_users(session_stub, base_url)

    session_stub.get.assert_called_once_with(f"{base_url}/admin/users", timeout=5)
    assert result[0]["id"] == 1


def test_fetch_users_propagates_connection_timeout(session_stub, base_url):
    session_stub.get.side_effect = requests.Timeout("timeout")

    with pytest.raises(requests.Timeout):
        fetch_users(session_stub, base_url)


def test_create_client_sends_payload_and_returns_created(session_stub, base_url):
    payload = {
        "name": "ООО Тест",
        "company": "ООО Тест",
        "phone": "+375291112233",
        "email": "client@test.by",
        "address": "Минск",
        "notes": "Новый клиент",
        "manager_id": 2,
    }
    created = {"id": 10, **payload}
    session_stub.post.return_value = Mock(status_code=201, json=Mock(return_value=created))

    result = create_client(session_stub, base_url, payload)

    session_stub.post.assert_called_once_with(
        f"{base_url}/admin/clients", json=payload, timeout=5
    )
    assert result["id"] == 10


def test_create_client_raises_on_validation_error(session_stub, base_url):
    session_stub.post.return_value = Mock(
        status_code=400,
        json=Mock(return_value={"error": "Некорректные данные клиента"}),
    )

    with pytest.raises(RuntimeError, match="Некорректные данные клиента"):
        create_client(session_stub, base_url, {"name": ""})


def test_delete_user_returns_deleted_user_payload(session_stub, base_url):
    response_payload = {"message": "Пользователь удалён", "user": {"id": 6}}
    session_stub.delete.return_value = Mock(
        status_code=200, json=Mock(return_value=response_payload)
    )

    result = delete_user(session_stub, base_url, 6)

    session_stub.delete.assert_called_once_with(f"{base_url}/admin/users/6", timeout=5)
    assert result["user"]["id"] == 6


def test_delete_user_raises_when_user_not_found(session_stub, base_url):
    session_stub.delete.return_value = Mock(
        status_code=404,
        json=Mock(return_value={"error": "Пользователь не найден"}),
    )

    with pytest.raises(RuntimeError, match="Пользователь не найден"):
        delete_user(session_stub, base_url, 9999)


def test_manager_update_client_success(session_stub, base_url):
    update_data = {"name": "Обновленный клиент", "company": "Новая компания"}
    session_stub.put.return_value = Mock(
        status_code=200,
        json=Mock(return_value={"id": 3, "name": "Обновленный клиент"}),
    )

    result = manager_update_client(session_stub, base_url, 2, 3, update_data)

    session_stub.put.assert_called_once_with(
        f"{base_url}/manager/2/clients/3",
        json=update_data,
        timeout=5,
    )
    assert result["name"] == "Обновленный клиент"


def test_manager_update_client_forbidden_foreign_client(session_stub, base_url):
    session_stub.put.return_value = Mock(
        status_code=404,
        json=Mock(return_value={"error": "Клиент не найден или не принадлежит вам"}),
    )

    with pytest.raises(RuntimeError, match="не принадлежит вам"):
        manager_update_client(session_stub, base_url, 2, 100, {"name": "Hack"})


def test_fetch_users_handles_empty_list(session_stub, base_url):
    session_stub.get.return_value = Mock(status_code=200, json=Mock(return_value=[]))

    result = fetch_users(session_stub, base_url)

    assert result == []


def test_handle_response_fallback_message_if_empty_error_payload():
    response = Mock()
    response.status_code = 503
    response.json.return_value = {}

    with pytest.raises(RuntimeError, match="HTTP error"):
        _handle_response(response)
