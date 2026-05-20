"""
Сценарий подготовки данных для демонстрации уведомлений (курсовой CRM).

Как устроены «уведомления» в приложении
----------------------------------------

1) Веб-интерфейс (дашборд)
   Блок «Уведомления» на главной странице заполняется из GET /api/dashboard/overview.
   Это не отдельная таблица «уведомлений», а вычисляемые на сервере сигналы по данным CRM:

   - Менеджер: просроченные задачи (срок в прошлом, статус не done), «рисковые» сделки
     (дата закрытия в ближайшие 7 дней, этап не won/lost), пропущенные звонки (часть
     сценариев на дашборде может фильтроваться).
   - Администратор: сводка по команде, те же типы алертов по всей базе плюс «логи»
     (в т.ч. недавние документы за 7 дней).

   Чтобы увидеть уведомления в UI: зайдите под нужным пользователем, откройте
   «Главная» / Dashboard и нажмите «Обновить данные».

2) Telegram (если настроен бот)
   При создании задачи и сделки backend вызывает telegramNotificationService:
   уходит сообщение только если задан TELEGRAM_BOT_TOKEN и у пользователя в профиле
   указан telegramChatId. Документы через этот сервис не уведомляют.

Запуск
------
Из корня проекта (сервер API должен быть запущен):

  set CRM_API_BASE_URL=http://localhost:4000
  pytest tests/test_notifications_seed_api.py -s

По умолчанию URL берётся из tests/config.py (переменная BASE_URL). Учётные данные
администратора: переменные CRM_TEST_ADMIN_EMAIL и CRM_TEST_ADMIN_PASSWORD; если
логин с паролем из CRM_TEST_ADMIN_PASSWORD не удался, пробуется запасной список
(1234, admin123) — под разные способы инициализации БД.

Тест создаёт пользователей и сущности и намеренно не удаляет их — чтобы можно было
войти в приложение и визуально проверить дашборд и связи (клиенты, сделки, задачи,
документы).
"""

from __future__ import annotations

import io
import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import requests

from config import BASE_URL as CONFIG_BASE_URL, TIMEOUT

BASE_URL = os.environ.get("CRM_API_BASE_URL", CONFIG_BASE_URL).rstrip("/")

ADMIN_EMAIL = os.environ.get("CRM_TEST_ADMIN_EMAIL", "admin@crm.by")
_ADMIN_PW_ENV = os.environ.get("CRM_TEST_ADMIN_PASSWORD")
ADMIN_PASSWORD_FALLBACKS = ["1234", "admin123"]

MANAGER_PASSWORD = "NotifSeed2026!"

# Минимальный PDF для multipart-загрузки (разрешённое расширение).
MINIMAL_PDF_BYTES = b"%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def _admin_password_candidates() -> list[str]:
    if _ADMIN_PW_ENV and _ADMIN_PW_ENV.strip():
        return [_ADMIN_PW_ENV.strip(), *ADMIN_PASSWORD_FALLBACKS]
    return list(ADMIN_PASSWORD_FALLBACKS)


def _login(session: requests.Session, email: str, password: str) -> str | None:
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        return None
    data = r.json()
    token = data.get("token")
    return token if isinstance(token, str) and token else None


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def _iso_date(d: date) -> str:
    return d.isoformat()


def _iso_dt_z(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="module")
def require_server(session: requests.Session):
    try:
        r = session.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
    except requests.RequestException as exc:
        pytest.skip(f"API недоступен ({BASE_URL}): {exc}")
    if r.status_code != 200:
        pytest.skip(f"Health check: ожидался 200, получено {r.status_code}")


@pytest.fixture(scope="module")
def admin_token(session: requests.Session, require_server) -> str:
    for pwd in _admin_password_candidates():
        token = _login(session, ADMIN_EMAIL, pwd)
        if token:
            print(f"\n[seed] Админ: вход как {ADMIN_EMAIL} (пароль подошёл).\n")
            return token
    pytest.skip(
        f"Не удалось войти как {ADMIN_EMAIL}. Задайте CRM_TEST_ADMIN_PASSWORD "
        f"или проверьте пароль в БД (пробовались: {_admin_password_candidates()})."
    )


@pytest.fixture(scope="module")
def admin_headers(admin_token: str) -> dict[str, str]:
    return _auth_headers(admin_token)


def test_seed_notification_demo_data(session: requests.Session, admin_headers: dict[str, str]):
    """
    Создаёт трёх менеджеров, клиентов, загрузки файлов, документы, сделки (разные этапы),
    задачи (разные статусы/приоритеты и сроки) — через публичный API от имени админа.

    Проверяет, что дашборд после этого отдаёт ненулевые сигналы (алерты / корзины задач).
    """
    tag = uuid.uuid4().hex[:10]
    managers: list[dict] = []

    # --- 1) Пользователи ---
    for i, name in enumerate(
        [
            f"Тест Уведомлений А {tag}",
            f"Тест Уведомлений Б {tag}",
            f"Тест Уведомлений В {tag}",
        ]
    ):
        email = f"notify_{tag}_{i}@demo.crm.local"
        body = {
            "fullName": name,
            "email": email,
            "password": MANAGER_PASSWORD,
            "phone": f"+37529{9000000 + i}",
        }
        r = session.post(f"{BASE_URL}/api/users", json=body, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, r.text
        user = r.json()
        uid = int(user["id"])
        managers.append({"id": uid, "email": email, "fullName": name})
        print(f"[seed] Создан пользователь id={uid} email={email}")

    today = date.today()
    closing_risk = today + timedelta(days=3)
    closing_risk_b = today + timedelta(days=5)
    due_overdue = datetime(2000, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    due_today_eod = datetime.combine(today, datetime.min.time()).replace(
        hour=23, minute=59, tzinfo=timezone.utc
    )
    due_week = datetime.combine(today + timedelta(days=4), datetime.min.time()).replace(
        hour=12, minute=0, tzinfo=timezone.utc
    )

    deal_stage_variants = ["new", "qualified", "proposal", "negotiation", "won", "lost"]
    task_status_variants = ["new", "in_progress", "blocked", "done"]
    task_priority_variants = ["low", "medium", "high", "urgent"]

    for idx, m in enumerate(managers):
        mid = m["id"]
        # --- Клиент ---
        client_payload = {
            "name": f"Клиент уведомлений #{idx + 1} ({tag})",
            "company": f"DemoCo-{tag}",
            "phone": f"+37517{100000 + idx}",
            "email": f"client_{tag}_{idx}@example.com",
            "address": "Минск",
            "notes": "Создано тестом test_notifications_seed_api",
            "managerId": mid,
        }
        rc = session.post(
            f"{BASE_URL}/api/clients",
            json=client_payload,
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert rc.status_code == 201, rc.text
        client = rc.json()
        client_id = int(client["id"])
        print(f"[seed] Клиент id={client_id} → менеджер id={mid}")

        # --- Загрузка файлов (multipart) и выбор имён из списка как «селект» с диска ---
        uploaded_names: list[str] = []
        for j, label in enumerate(["contract", "spec"]):
            fname = f"notify_{tag}_{mid}_{label}.pdf"
            files = {"file": (fname, io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")}
            data = {"clientId": str(client_id)}
            ru = session.post(
                f"{BASE_URL}/api/uploads/docs",
                files=files,
                data=data,
                headers={"Authorization": admin_headers["Authorization"]},
                timeout=TIMEOUT,
            )
            assert ru.status_code == 201, ru.text
            stored = ru.json().get("filename")
            assert isinstance(stored, str) and stored
            uploaded_names.append(stored)
            print(f"[seed] Загружен файл: {stored}")

        listed = session.get(
            f"{BASE_URL}/api/uploads/docs",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert listed.status_code == 200
        index_by_name = {row["filename"]: row for row in listed.json() if isinstance(row, dict)}
        for name in uploaded_names:
            assert name in index_by_name, f"Файл {name} должен появиться в GET /api/uploads/docs"

        # --- Документы (привязка к клиенту и загрузчику; filename из индекса) ---
        for stored_name in uploaded_names:
            row = index_by_name[stored_name]
            doc_payload = {
                "clientId": client_id,
                "filename": row["filename"],
                "filePath": row.get("filePath") or f"/uploads/docs/{row['filename']}",
                "uploaderId": mid,
                "fileSize": row.get("fileSize"),
                "mimeType": row.get("mimeType") or "application/pdf",
            }
            rd = session.post(
                f"{BASE_URL}/api/documents",
                json=doc_payload,
                headers=admin_headers,
                timeout=TIMEOUT,
            )
            assert rd.status_code == 201, rd.text
            print(f"[seed] Документ id={rd.json().get('id')} filename={stored_name}")

        # --- Сделки: все этапы workflow, разные суммы и даты закрытия ---
        deals_meta = [
            {
                "title": f"Сделка NEW {tag} #{idx}",
                "stage": deal_stage_variants[0],
                "amount": 1000 + idx,
                "closingDate": _iso_date(today + timedelta(days=30)),
            },
            {
                "title": f"Сделка QUALIFIED {tag} #{idx}",
                "stage": deal_stage_variants[1],
                "amount": 2500,
                "closingDate": _iso_date(today + timedelta(days=25)),
            },
            {
                "title": f"Сделка PROPOSAL {tag} #{idx}",
                "stage": deal_stage_variants[2],
                "amount": 5000.5,
                "closingDate": _iso_date(closing_risk_b),
            },
            {
                "title": f"Сделка NEGOTIATION (риск) {tag} #{idx}",
                "stage": deal_stage_variants[3],
                "amount": 99999.99,
                "closingDate": _iso_date(closing_risk),
            },
            {
                "title": f"Сделка WON {tag} #{idx}",
                "stage": deal_stage_variants[4],
                "amount": 12000,
                "closingDate": _iso_date(today - timedelta(days=1)),
            },
            {
                "title": f"Сделка LOST {tag} #{idx}",
                "stage": deal_stage_variants[5],
                "amount": 300,
                "closingDate": _iso_date(today - timedelta(days=2)),
            },
        ]
        deal_ids: list[int] = []
        for dm in deals_meta:
            deal_payload = {
                "title": dm["title"],
                "description": "Тестовые данные для дашборда и Telegram",
                "amount": dm["amount"],
                "stage": dm["stage"],
                "closingDate": dm["closingDate"],
                "clientId": client_id,
                "managerId": mid,
            }
            rz = session.post(
                f"{BASE_URL}/api/deals",
                json=deal_payload,
                headers=admin_headers,
                timeout=TIMEOUT,
            )
            assert rz.status_code == 201, rz.text
            deal_ids.append(int(rz.json()["id"]))
        print(f"[seed] Создано сделок: {len(deal_ids)} для менеджера id={mid}")

        # --- Задачи: статусы/приоритеты + сроки (просрочка / сегодня / неделя) ---
        negotiation_deal_id = deal_ids[3]
        tasks_plan = [
            {
                "title": f"Просроченная задача NEW {tag}",
                "status": task_status_variants[0],
                "priority": task_priority_variants[3],
                "dueDate": _iso_dt_z(due_overdue),
                "dealId": negotiation_deal_id,
            },
            {
                "title": f"Просроченная IN_PROGRESS {tag}",
                "status": task_status_variants[1],
                "priority": task_priority_variants[2],
                "dueDate": _iso_dt_z(due_overdue),
                "dealId": negotiation_deal_id,
            },
            {
                "title": f"Просроченная BLOCKED {tag}",
                "status": task_status_variants[2],
                "priority": task_priority_variants[1],
                "dueDate": _iso_dt_z(due_overdue),
                "dealId": negotiation_deal_id,
            },
            {
                "title": f"Задача DONE с прошлым сроком {tag}",
                "status": task_status_variants[3],
                "priority": task_priority_variants[0],
                "dueDate": _iso_dt_z(due_overdue),
                "dealId": negotiation_deal_id,
            },
            {
                "title": f"Задача на сегодня {tag}",
                "status": task_status_variants[0],
                "priority": task_priority_variants[1],
                "dueDate": _iso_dt_z(due_today_eod),
                "dealId": negotiation_deal_id,
            },
            {
                "title": f"Задача на неделю {tag}",
                "status": task_status_variants[1],
                "priority": task_priority_variants[0],
                "dueDate": _iso_dt_z(due_week),
                "dealId": negotiation_deal_id,
            },
        ]
        for tp in tasks_plan:
            task_payload = {
                "title": tp["title"],
                "description": "Сгенерировано API-тестом уведомлений",
                "status": tp["status"],
                "priority": tp["priority"],
                "dueDate": tp["dueDate"],
                "authorId": mid,
                "clientId": client_id,
                "dealId": tp["dealId"],
            }
            rt = session.post(
                f"{BASE_URL}/api/tasks",
                json=task_payload,
                headers=admin_headers,
                timeout=TIMEOUT,
            )
            assert rt.status_code == 201, rt.text
        print(f"[seed] Создано задач: {len(tasks_plan)} для менеджера id={mid}")

    # --- Проверка дашборда (именно то, что питает «Уведомления» в SPA) ---
    dash_admin = session.get(f"{BASE_URL}/api/dashboard/overview", headers=admin_headers, timeout=TIMEOUT)
    assert dash_admin.status_code == 200
    admin_payload = dash_admin.json()
    admin_alerts = admin_payload.get("alerts") or []
    assert isinstance(admin_alerts, list)
    assert len(admin_alerts) > 0, "У админа должны появиться алерты (просрочки/риски) после сидирования."

    for m in managers:
        tok = _login(session, m["email"], MANAGER_PASSWORD)
        assert tok, f"Не удалось войти как {m['email']}"
        mh = _auth_headers(tok)
        dm = session.get(f"{BASE_URL}/api/dashboard/overview", headers=mh, timeout=TIMEOUT)
        assert dm.status_code == 200
        mp = dm.json()
        buckets = mp.get("taskBuckets") or {}
        overdue = buckets.get("overdue") or []
        alerts_m = mp.get("alerts") or []
        assert len(overdue) > 0 or len(alerts_m) > 0, (
            f"У менеджера id={m['id']} ожидались просрочки в корзине или алерты на дашборде."
        )

    print(
        "\n=== Итог: тестовые учётные записи (пароль один для всех ниже) ===\n"
        f"Пароль менеджеров: {MANAGER_PASSWORD}\n"
    )
    for m in managers:
        print(f"  • {m['fullName']} — {m['email']}")
    print(
        "\nЧто смотреть в приложении:\n"
        "  1) Войти под менеджером → Dashboard: блок «Уведомления», фильтры задач "
        "(Просроченные / Сегодня / Неделя).\n"
        "  2) Войти под админом → Dashboard: сводные алерты и «логи» по документам за 7 дней.\n"
        "  3) Telegram: только при TELEGRAM_BOT_TOKEN и заполненном telegramChatId в профиле.\n"
        f"\nМаркер данных в названиях сущностей: {tag}\n"
    )
