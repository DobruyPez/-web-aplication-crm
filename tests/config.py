# Конфигурация для тестов
BASE_URL = "http://localhost:3000"

# ID тестовых пользователей (должны существовать в БД после tests/seed_test_data.sql)
# Админ: user_1@test.crm.local / 1234 (id = 1)
ADMIN_ID = 1
MANAGER_IVANOV_ID = 2
MANAGER_PETROVA_ID = 3

# Таймаут для запросов (секунды)
TIMEOUT = 10

# Заголовки для ролей (новая архитектура использует x-user-role и x-user-id)
HEADERS_ADMIN = {
    "x-user-role": "ADMIN",
    "x-user-id": str(ADMIN_ID),
    "Content-Type": "application/json"
}

HEADERS_MANAGER_IVANOV = {
    "x-user-role": "MANAGER",
    "x-user-id": str(MANAGER_IVANOV_ID),
    "Content-Type": "application/json"
}

HEADERS_MANAGER_PETROVA = {
    "x-user-role": "MANAGER",
    "x-user-id": str(MANAGER_PETROVA_ID),
    "Content-Type": "application/json"
}