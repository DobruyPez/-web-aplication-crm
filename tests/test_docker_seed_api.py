"""
Сидирование CRM через API для развёртывания в Docker.

Перед запуском поднимите стек:

  cd B:\\Course\\Project
  docker compose -f deploy/docker-compose.yml up -d --build

По умолчанию API доступен через nginx на порту 8088 (HTTP, без предупреждения сертификата).
Учётная запись администратора из Prisma seed в Docker: admin@crm.by / 1234.

Запуск из корня проекта:

  pytest tests/test_docker_seed_api.py -s

или:

  npm run test:docker:seed

Переопределение URL (HTTPS или IP в LAN):

  set CRM_API_BASE_URL=http://192.168.1.10:8088
  pytest tests/test_docker_seed_api.py -s

Дополнительно заливает данные через API (если нужно ещё раз после `prisma db seed` в Docker).
Базовые демо-данные уже создаются при `docker compose up` (backend/prisma/seed.js).

Проверка, что seed в Docker уже отработал:

  pytest tests/test_docker_seed_api.py -s -k verify
"""

from __future__ import annotations

import os

# Должно быть задано до загрузки test_notifications_seed_api (там читается os.environ).
os.environ.setdefault("CRM_API_BASE_URL", "http://localhost:8088")
os.environ.setdefault("CRM_TEST_ADMIN_EMAIL", "admin@crm.by")
os.environ.setdefault("CRM_TEST_ADMIN_PASSWORD", "1234")

# Регистрирует session, require_server, admin_token, admin_headers и др.
pytest_plugins = ["test_notifications_seed_api"]

import requests

from test_notifications_seed_api import ADMIN_EMAIL, BASE_URL, _seed_notification_demo_data_impl

__all__ = ["test_seed_docker_demo_data", "BASE_URL", "ADMIN_EMAIL"]


def test_docker_prisma_seed_present(session: requests.Session, admin_headers: dict[str, str]):
    """Проверяет, что после docker compose db-bootstrap есть демо-клиенты из prisma seed."""
    r = session.get(f"{BASE_URL}/api/clients", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    demo = [c for c in items if isinstance(c, dict) and "Демо-клиент" in str(c.get("name", ""))]
    assert len(demo) >= 2, (
        "Ожидались демо-клиенты из prisma seed. Пересоздайте том: "
        "docker compose -f deploy/docker-compose.yml down -v && ... up -d --build"
    )
    print(f"\n[docker-seed] OK: найдено демо-клиентов: {len(demo)} (API {BASE_URL})\n")


def test_seed_docker_demo_data(session: requests.Session, admin_headers: dict[str, str]):
    """Дополнительная заливка через API (опционально, большой набор notify_*)."""
    print(f"\n[docker-seed] API: {BASE_URL}")
    print(f"[docker-seed] Админ: {ADMIN_EMAIL}\n")
    _seed_notification_demo_data_impl(session, admin_headers)
