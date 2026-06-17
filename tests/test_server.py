import requests
import pytest
from datetime import datetime
from config import (
    BASE_URL, ADMIN_ID, MANAGER_IVANOV_ID, MANAGER_PETROVA_ID, TIMEOUT,
    HEADERS_ADMIN, HEADERS_MANAGER_IVANOV, HEADERS_MANAGER_PETROVA
)

# ============================================================
# ФИКСТУРЫ
# ============================================================

@pytest.fixture(scope="session")
def base_url():
    """Базовый URL сервера"""
    return BASE_URL

@pytest.fixture(scope="session")
def session():
    """HTTP сессия для повторного использования соединений"""
    s = requests.Session()
    yield s
    s.close()

@pytest.fixture
def test_user_data():
    """Тестовые данные для создания пользователя"""
    timestamp = datetime.now().strftime('%H%M%S%f')
    return {
        "fullName": f"Тестовый пользователь {timestamp}",
        "email": f"test_{timestamp}@example.com",
        "password": "securePassword123",
        "role": "manager",
        "phone": "+375291234567"
    }

@pytest.fixture
def test_client_data():
    """Тестовые данные для создания клиента"""
    return {
        "name": "ООО Тестовая компания",
        "address": "Минск, ул. Тестовая 1",
        "notes": "Создано автотестом",
        "contactPoints": [
            {
                "type": "mobile",
                "value": "+375290000000",
                "contactName": "Иван Петров",
            },
            {
                "type": "email",
                "value": "test@test.by",
                "contactName": "Иван Петров",
            },
            {
                "type": "fax",
                "value": "+375291111111",
                "contactName": "Бухгалтерия",
            },
        ],
    }

@pytest.fixture
def test_deal_data():
    """Тестовые данные для создания сделки"""
    return {
        "title": f"Тестовая сделка {datetime.now().timestamp()}",
        "description": "Описание тестовой сделки",
        "amount": 100000.00,
        "stage": "новый",
        "closingDate": "2026-06-01",
        "clientId": None  # Будет подставлен в тесте
    }

@pytest.fixture
def test_task_data():
    """Тестовые данные для создания задачи"""
    return {
        "title": f"Тестовая задача {datetime.now().timestamp()}",
        "description": "Описание тестовой задачи",
        "status": "new",
        "priority": "high",
        "dueDate": "2026-05-01T12:00:00"
    }

@pytest.fixture
def test_call_data():
    """Тестовые данные для создания звонка"""
    return {
        "direction": "out",
        "status": "completed",
        "duration": 120,
        "recordingUrl": "https://storage/test_call.mp3",
        "startedAt": "2026-04-25T10:00:00",
        "endedAt": "2026-04-25T10:02:00",
        "clientId": None  # Будет подставлен в тесте
    }

@pytest.fixture
def test_document_data():
    """Тестовые данные для загрузки документа"""
    return {
        "filename": "test_document.pdf",
        "filePath": "/uploads/test_document.pdf",
        "fileSize": 102400,
        "mimeType": "application/pdf",
        "clientId": None  # Будет подставлен в тесте
    }


# ============================================================
# 1. БАЗОВЫЕ ПРОВЕРКИ
# ============================================================

class TestBasic:
    """Базовые проверки работоспособности сервера"""

    def test_server_running(self, base_url, session):
        """Проверка, что сервер запущен и отвечает"""
        response = session.get(f"{base_url}/", timeout=TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "docs" in data
        assert "endpoints" in data["docs"]
        print(f"✅ Сервер запущен. API: {data['name']}")
        print(f"   Доступно эндпоинтов: {len(data['docs']['endpoints'])}")

    def test_health_check(self, base_url, session):
        """Проверка эндпоинта здоровья"""
        response = session.get(f"{base_url}/api/health", timeout=TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print(f"✅ Health check: {data['status']}")


# ============================================================
# 2. ТЕСТЫ АДМИНИСТРАТОРА
# ============================================================

class TestAdminUsers:
    """Тесты управления пользователями (администратор)"""

    created_user_id = None

    def test_get_all_users(self, base_url, session):
        """Получение списка всех пользователей"""
        response = session.get(
            f"{base_url}/api/users",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"✅ Получено пользователей: {len(users)}")
        for u in users:
            print(f"   - ID:{u['id']} {u['fullName']} ({u['role']})")

    def test_create_user(self, base_url, session, test_user_data):
        """Создание нового пользователя"""
        response = session.post(
            f"{base_url}/api/users",
            json=test_user_data,
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        assert created["fullName"] == test_user_data["fullName"]
        assert created["role"] == test_user_data["role"]
        
        TestAdminUsers.created_user_id = created["id"]
        print(f"✅ Создан пользователь: ID:{created['id']} {created['fullName']}")

    def test_get_user_by_id(self, base_url, session):
        """Получение пользователя по ID"""
        if not TestAdminUsers.created_user_id:
            pytest.skip("Нет созданного пользователя для проверки")
        
        response = session.get(
            f"{base_url}/api/users/{TestAdminUsers.created_user_id}",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        user = response.json()
        assert user["id"] == TestAdminUsers.created_user_id
        print(f"✅ Получен пользователь: ID:{user['id']} {user['fullName']}")

    def test_update_user(self, base_url, session):
        """Обновление пользователя"""
        if not TestAdminUsers.created_user_id:
            pytest.skip("Нет созданного пользователя для обновления")
        
        update_data = {
            "fullName": "Обновлённый пользователь",
            "email": f"updated_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "newSecurePassword123",
            "role": "manager",
            "phone": "+375299999999"
        }
        
        response = session.put(
            f"{base_url}/api/users/{TestAdminUsers.created_user_id}",
            json=update_data,
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["fullName"] == update_data["fullName"]
        print(f"✅ Обновлён пользователь: ID:{updated['id']} {updated['fullName']}")

    def test_delete_user(self, base_url, session):
        """Удаление пользователя"""
        if not TestAdminUsers.created_user_id:
            pytest.skip("Нет созданного пользователя для удаления")
        
        response = session.delete(
            f"{base_url}/api/users/{TestAdminUsers.created_user_id}",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        data = response.json()
        assert data["item"]["id"] == TestAdminUsers.created_user_id
        print(f"✅ Удалён пользователь ID:{TestAdminUsers.created_user_id}")


class TestAdminClients:
    """Тесты управления клиентами (администратор)"""

    created_client_id = None

    def test_get_all_clients(self, base_url, session):
        """Получение списка всех клиентов"""
        response = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        clients = response.json()
        assert isinstance(clients, list)
        print(f"✅ Всего клиентов: {len(clients)}")
        for c in clients[:5]:  # Показываем первые 5
            print(f"   - ID:{c['id']} {c['name']}")

    def test_create_client(self, base_url, session, test_client_data):
        """Создание клиента администратором"""
        test_client_data["managerId"] = MANAGER_IVANOV_ID
        
        response = session.post(
            f"{base_url}/api/clients",
            json=test_client_data,
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        assert created["name"] == test_client_data["name"]
        assert isinstance(created.get("contactPoints"), list)
        assert len(created["contactPoints"]) == 3
        
        TestAdminClients.created_client_id = created["id"]
        print(f"✅ Админ создал клиента: ID:{created['id']} {created['name']}")

    def test_update_client(self, base_url, session):
        """Обновление клиента администратором"""
        if not TestAdminClients.created_client_id:
            pytest.skip("Нет созданного клиента для обновления")
        
        update_data = {
            "name": "Обновлённый админом клиент",
            "address": "Обновлённый адрес",
            "notes": "Обновлено автотестом",
            "managerId": MANAGER_PETROVA_ID,
            "contactPoints": [
                {
                    "type": "mobile",
                    "value": "+375299999999",
                    "contactName": "Новый контакт",
                },
                {
                    "type": "email",
                    "value": "updated@admin.by",
                    "contactName": "Новый контакт",
                },
            ],
        }
        
        response = session.put(
            f"{base_url}/api/clients/{TestAdminClients.created_client_id}",
            json=update_data,
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["name"] == update_data["name"]
        print(f"✅ Админ обновил клиента: ID:{updated['id']} {updated['name']}")

    def test_delete_client(self, base_url, session):
        """Удаление клиента администратором"""
        if not TestAdminClients.created_client_id:
            pytest.skip("Нет созданного клиента для удаления")
        
        response = session.delete(
            f"{base_url}/api/clients/{TestAdminClients.created_client_id}",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        data = response.json()
        assert data["item"]["id"] == TestAdminClients.created_client_id
        print(f"✅ Админ удалил клиента ID:{TestAdminClients.created_client_id}")


class TestAdminOther:
    """Тесты просмотра остальных сущностей администратором"""

    def test_get_all_deals(self, base_url, session):
        response = session.get(
            f"{base_url}/api/deals",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        deals = response.json()
        assert isinstance(deals, list)
        print(f"✅ Всего сделок: {len(deals)}")

    def test_get_all_tasks(self, base_url, session):
        response = session.get(
            f"{base_url}/api/tasks",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        print(f"✅ Всего задач: {len(tasks)}")

    def test_get_all_calls(self, base_url, session):
        response = session.get(
            f"{base_url}/api/calls",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        calls = response.json()
        assert isinstance(calls, list)
        print(f"✅ Всего звонков: {len(calls)}")

    def test_get_all_documents(self, base_url, session):
        response = session.get(
            f"{base_url}/api/documents",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        docs = response.json()
        assert isinstance(docs, list)
        print(f"✅ Всего документов: {len(docs)}")


# ============================================================
# 3. ТЕСТЫ МЕНЕДЖЕРА
# ============================================================

class TestManagerClients:
    """Тесты управления клиентами (менеджер)"""

    created_client_id = None

    def test_get_own_clients(self, base_url, session):
        """Получение своих клиентов"""
        response = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        clients = response.json()
        assert isinstance(clients, list)
        # Проверяем, что все клиенты принадлежат менеджеру (если есть scope)
        for c in clients:
            if "managerId" in c:
                assert c["managerId"] == MANAGER_IVANOV_ID
        print(f"✅ Клиентов менеджера {MANAGER_IVANOV_ID}: {len(clients)}")

    def test_create_client(self, base_url, session, test_client_data):
        """Создание клиента менеджером"""
        response = session.post(
            f"{base_url}/api/clients",
            json=test_client_data,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        # Менеджер должен создавать клиента только для себя
        if "managerId" in created:
            assert created["managerId"] == MANAGER_IVANOV_ID
        
        TestManagerClients.created_client_id = created["id"]
        print(f"✅ Менеджер создал клиента: ID:{created['id']} {created['name']}")

    def test_update_own_client(self, base_url, session):
        """Обновление своего клиента"""
        if not TestManagerClients.created_client_id:
            pytest.skip("Нет созданного клиента для обновления")
        
        update_data = {
            "name": "Моя обновлённая компания",
            "address": "Мой новый адрес",
            "notes": "Обновлено менеджером",
            "contactPoints": [
                {
                    "type": "mobile",
                    "value": "+375298888888",
                    "contactName": "Менеджерский контакт",
                },
                {
                    "type": "email",
                    "value": "myupdated@manager.by",
                    "contactName": "Менеджерский контакт",
                },
            ],
        }
        
        response = session.put(
            f"{base_url}/api/clients/{TestManagerClients.created_client_id}",
            json=update_data,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["name"] == update_data["name"]
        print(f"✅ Менеджер обновил клиента: ID:{updated['id']} {updated['name']}")

    def test_update_other_manager_client(self, base_url, session):
        """Попытка обновления чужого клиента (должна быть ошибка)"""
        # Получаем клиентов Петровой
        response = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_PETROVA,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        petrova_clients = response.json()
        
        if not petrova_clients:
            print("⚠️ У Петровой нет клиентов, пропускаем проверку")
            return
        
        # Пытаемся обновить клиента Петровой от имени Иванова
        other_client_id = petrova_clients[0]["id"]
        response = session.put(
            f"{base_url}/api/clients/{other_client_id}",
            json={"name": "Взлом"},
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        # Должен быть 404 (не найден) или 403 (доступ запрещён)
        assert response.status_code in [403, 404]
        print(f"✅ Доступ к чужому клиенту заблокирован (статус {response.status_code})")

    def test_delete_client(self, base_url, session):
        """Удаление своего клиента"""
        if not TestManagerClients.created_client_id:
            pytest.skip("Нет созданного клиента для удаления")
        
        response = session.delete(
            f"{base_url}/api/clients/{TestManagerClients.created_client_id}",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        print(f"✅ Менеджер удалил клиента ID:{TestManagerClients.created_client_id}")


class TestManagerDeals:
    """Тесты управления сделками (менеджер)"""

    created_deal_id = None

    def test_get_own_deals(self, base_url, session):
        response = session.get(
            f"{base_url}/api/deals",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        deals = response.json()
        print(f"✅ Сделок менеджера {MANAGER_IVANOV_ID}: {len(deals)}")

    def test_create_deal(self, base_url, session, test_deal_data):
        """Создание сделки"""
        # Сначала получаем ID клиента менеджера
        clients_resp = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        clients = clients_resp.json()
        
        if not clients:
            pytest.skip("Нет клиентов для создания сделки")
        
        test_deal_data["clientId"] = clients[0]["id"]
        
        response = session.post(
            f"{base_url}/api/deals",
            json=test_deal_data,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        TestManagerDeals.created_deal_id = created["id"]
        print(f"✅ Создана сделка: ID:{created['id']} {created['title']}")


class TestManagerTasks:
    """Тесты управления задачами (менеджер)"""

    created_task_id = None

    def test_get_own_tasks(self, base_url, session):
        response = session.get(
            f"{base_url}/api/tasks",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        tasks = response.json()
        print(f"✅ Задач менеджера {MANAGER_IVANOV_ID}: {len(tasks)}")

    def test_create_task(self, base_url, session, test_task_data):
        """Создание задачи"""
        response = session.post(
            f"{base_url}/api/tasks",
            json=test_task_data,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        TestManagerTasks.created_task_id = created["id"]
        print(f"✅ Создана задача: ID:{created['id']} {created['title']}")


class TestManagerCalls:
    """Тесты работы со звонками (менеджер)"""

    created_call_id = None

    def test_get_own_calls(self, base_url, session):
        response = session.get(
            f"{base_url}/api/calls",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        calls = response.json()
        print(f"✅ Звонков менеджера {MANAGER_IVANOV_ID}: {len(calls)}")

    def test_create_call(self, base_url, session, test_call_data):
        """Инициация звонка"""
        clients_resp = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        clients = clients_resp.json()
        
        if not clients:
            pytest.skip("Нет клиентов для инициации звонка")
        
        test_call_data["clientId"] = clients[0]["id"]
        
        response = session.post(
            f"{base_url}/api/calls",
            json=test_call_data,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        TestManagerCalls.created_call_id = created["id"]
        print(f"✅ Звонок инициирован: ID:{created['id']}")


class TestManagerDocuments:
    """Тесты работы с документами (менеджер)"""

    created_doc_id = None

    def test_get_own_documents(self, base_url, session):
        response = session.get(
            f"{base_url}/api/documents",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        docs = response.json()
        print(f"✅ Документов менеджера {MANAGER_IVANOV_ID}: {len(docs)}")

    def test_upload_document(self, base_url, session, test_document_data):
        """Загрузка документа"""
        clients_resp = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        clients = clients_resp.json()
        
        if not clients:
            pytest.skip("Нет клиентов для загрузки документа")
        
        test_document_data["clientId"] = clients[0]["id"]
        
        response = session.post(
            f"{base_url}/api/documents",
            json=test_document_data,
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        assert response.status_code == 201
        created = response.json()
        TestManagerDocuments.created_doc_id = created["id"]
        print(f"✅ Документ загружен: ID:{created['id']}")


# ============================================================
# 4. ТЕСТЫ РАЗГРАНИЧЕНИЯ ДОСТУПА
# ============================================================

class TestAccessControl:
    """Проверки разграничения доступа"""

    def test_manager_scoped_to_self(self, base_url, session):
        """Менеджер видит только свои данные (scope)"""
        # Получаем данные обоих менеджеров
        resp1 = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        resp2 = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_PETROVA,
            timeout=TIMEOUT
        )
        
        clients1 = resp1.json()
        clients2 = resp2.json()
        
        # Проверяем, что у разных менеджеров нет общих клиентов
        ids1 = {c["id"] for c in clients1}
        ids2 = {c["id"] for c in clients2}
        common = ids1 & ids2
        assert len(common) == 0, f"Найдены общие клиенты: {common}"
        
        print(f"✅ Иванов: {len(clients1)} клиентов, Петрова: {len(clients2)} клиентов, общих: 0")

    def test_admin_can_access_anything(self, base_url, session):
        """Администратор имеет доступ ко всем данным"""
        # Админ должен видеть ВСЕХ клиентов
        resp_admin = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        resp_manager = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_MANAGER_IVANOV,
            timeout=TIMEOUT
        )
        
        admin_clients = resp_admin.json()
        manager_clients = resp_manager.json()
        
        # Админ должен видеть не меньше клиентов, чем менеджер
        assert len(admin_clients) >= len(manager_clients)
        print(f"✅ Админ видит {len(admin_clients)} клиентов, менеджер {len(manager_clients)}")


# ============================================================
# 5. ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
# ============================================================

class TestDataIntegrity:
    """Проверки целостности и форматов данных"""

    def test_user_has_required_fields(self, base_url, session):
        """Проверка полей пользователя"""
        response = session.get(
            f"{base_url}/api/users",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        users = response.json()
        required_fields = ["id", "fullName", "email", "role"]
        for user in users:
            for field in required_fields:
                assert field in user, f"Поле {field} отсутствует у пользователя {user.get('id')}"
        print(f"✅ Все пользователи имеют обязательные поля")

    def test_client_has_required_fields(self, base_url, session):
        """Проверка полей клиента"""
        response = session.get(
            f"{base_url}/api/clients",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        clients = response.json()
        required_fields = ["id", "name"]
        for client in clients:
            for field in required_fields:
                assert field in client, f"Поле {field} отсутствует у клиента {client.get('id')}"
        print(f"✅ Все клиенты имеют обязательные поля")

    def test_user_role_is_valid(self, base_url, session):
        """Проверка ролей пользователей"""
        response = session.get(
            f"{base_url}/api/users",
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT
        )
        users = response.json()
        valid_roles = ["admin", "manager"]
        for user in users:
            assert user["role"] in valid_roles, \
                f"Недопустимая роль {user['role']} у пользователя {user['id']}"
        print(f"✅ Все пользователи имеют корректную роль")


# ============================================================
# ЗАПУСК ТЕСТОВ
# ============================================================

if __name__ == "__main__":
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--color=yes",
        "--html=test_report.html",
        "--self-contained-html",
    ])