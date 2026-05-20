"""
Автотесты UI-фильтров (логика как в frontend ResourcePanel + корзины дашборда).

Требуются запущенный backend и переменные из tests/config.py (BASE_URL, заголовки ролей).
"""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
import requests

from config import BASE_URL, HEADERS_ADMIN, HEADERS_MANAGER_IVANOV, TIMEOUT
from ui_filters.constants import DEAL_STAGES, TASK_STATUSES
from ui_filters.dashboard_engine import task_matches_bucket
from ui_filters.pages import discover_filter_pages, get_static_filter_pages
from ui_filters.resource_panel_engine import (
    filter_and_sort,
    filter_resource_items,
    quick_filter_values_for_resource,
)

REPO_ROOT = str(Path(__file__).resolve().parents[1])


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="module")
def require_api(session):
    try:
        r = session.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
    except requests.RequestException:
        pytest.skip(f"API недоступен: {BASE_URL}")
    if r.status_code != 200:
        pytest.skip(f"Health failed: {r.status_code}")


def _by_id(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    out: dict[int, dict[str, Any]] = {}
    for row in rows:
        i = row.get("id")
        if i is not None:
            out[int(i)] = row
    return out


def _get_json(session: requests.Session, path: str, headers: dict) -> list | dict:
    r = session.get(f"{BASE_URL}{path}", headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


@pytest.mark.usefixtures("require_api")
class TestDiscoverFilterPages:
    def test_static_list_contains_resource_and_dashboard(self):
        pages = get_static_filter_pages()
        kinds = {p.kind for p in pages}
        assert "resource_panel" in kinds
        assert "dashboard_task_buckets" in kinds
        paths = {p.path for p in pages}
        assert "/clients" in paths and "/" in paths

    def test_discover_matches_frontend_sources(self):
        pages = discover_filter_pages(REPO_ROOT)
        assert len(pages) == len(get_static_filter_pages())


@pytest.mark.usefixtures("require_api")
class TestResourcePanelQuickFilters:
    """Все значения быстрых чипов + соответствие отфильтрованных строк правилу."""

    @pytest.mark.parametrize("resource_key", ["tasks", "deals"])
    def test_quick_filter_each_value(self, session, resource_key: str):
        path = f"/api/{resource_key}"
        items = _get_json(session, path, HEADERS_ADMIN)
        assert isinstance(items, list)
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(_get_json(session, "/api/deals", HEADERS_ADMIN))

        for qf in quick_filter_values_for_resource(resource_key):
            filtered = filter_resource_items(
                resource_key,
                items,
                quick_filter=qf,
                clients_by_id=clients,
                users_by_id=users,
                deals_by_id=deals,
            )
            if qf == "all":
                assert len(filtered) == len(items)
                continue
            if resource_key == "tasks":
                for it in filtered:
                    assert str(it.get("status") or "").lower().replace(" ", "_") == qf
            elif resource_key == "deals":
                for it in filtered:
                    assert str(it.get("stage") or "").lower().replace(" ", "_") == qf

    def test_users_quick_roles(self, session):
        items = _get_json(session, "/api/users", HEADERS_ADMIN)
        assert isinstance(items, list)
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(items)
        deals: dict[int, dict[str, Any]] = {}

        for qf in quick_filter_values_for_resource("users"):
            filtered = filter_resource_items(
                "users",
                items,
                quick_filter=qf,
                clients_by_id=clients,
                users_by_id=users,
                deals_by_id=deals,
            )
            if qf == "all":
                assert len(filtered) == len(items)
                continue
            for it in filtered:
                assert str(it.get("role") or "").strip().lower() == qf


@pytest.mark.usefixtures("require_api")
class TestResourcePanelFieldAndSearch:
    def test_clients_field_filter_id(self, session):
        items = _get_json(session, "/api/clients", HEADERS_ADMIN)
        if not items:
            pytest.skip("Нет клиентов в БД")
        sample = items[0]
        cid = sample["id"]
        clients = _by_id(items)
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(_get_json(session, "/api/deals", HEADERS_ADMIN))

        needle = str(cid)
        filtered = filter_resource_items(
            "clients",
            items,
            filter_field="id",
            filter_value=needle,
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        assert all(str(x.get("id", "")).find(needle) >= 0 for x in filtered)
        assert any(x.get("id") == cid for x in filtered)

    def test_search_finds_company_substring(self, session):
        items = _get_json(session, "/api/clients", HEADERS_ADMIN)
        if not items:
            pytest.skip("Нет клиентов в БД")
        sample = next((x for x in items if x.get("company")), None)
        if not sample:
            pytest.skip("Нет поля company")
        fragment = str(sample["company"])[:5].lower()
        if len(fragment) < 2:
            pytest.skip("company слишком короткий")

        clients = _by_id(items)
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(_get_json(session, "/api/deals", HEADERS_ADMIN))

        filtered = filter_resource_items(
            "clients",
            items,
            search_text=fragment,
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        assert len(filtered) >= 1
        assert any(fragment in str(v).lower() for it in filtered for v in it.values())

    def test_documents_field_filter_filename(self, session):
        items = _get_json(session, "/api/documents", HEADERS_ADMIN)
        if not items:
            pytest.skip("Нет документов в БД")
        sample = items[0]
        fn = str(sample.get("filename") or "")
        if len(fn) < 3:
            pytest.skip("Короткое имя файла")
        fragment = fn[:4].lower()
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals: dict[int, dict[str, Any]] = {}
        filtered = filter_resource_items(
            "documents",
            items,
            filter_field="filename",
            filter_value=fragment,
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        assert filtered
        for it in filtered:
            assert fragment in str(it.get("filename") or "").lower()

    def test_combined_quick_and_search_tasks(self, session):
        items = _get_json(session, "/api/tasks", HEADERS_ADMIN)
        if len(items) < 2:
            pytest.skip("Мало задач для комбинированного теста")
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(_get_json(session, "/api/deals", HEADERS_ADMIN))

        st = str(TASK_STATUSES[0])
        subset = [x for x in items if str(x.get("status") or "").lower().replace(" ", "_") == st]
        if not subset:
            pytest.skip("Нет задач со статусом " + st)
        title_part = str(subset[0].get("title") or "task")[:4]

        filtered = filter_resource_items(
            "tasks",
            items,
            search_text=title_part,
            quick_filter=st,
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        for it in filtered:
            assert str(it.get("status") or "").lower().replace(" ", "_") == st
            hay = " ".join(str(v) for v in it.values()).lower()
            assert title_part.lower() in hay


@pytest.mark.usefixtures("require_api")
class TestResourcePanelSort:
    def test_sort_id_desc_first_is_max_id(self, session):
        items = _get_json(session, "/api/deals", HEADERS_ADMIN)
        if len(items) < 2:
            pytest.skip("Мало сделок")
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(items)
        sorted_rows = filter_and_sort(
            "deals",
            items,
            sort_field="id",
            sort_direction="desc",
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        ids = [int(x["id"]) for x in sorted_rows]
        assert ids == sorted(ids, reverse=True)


@pytest.mark.usefixtures("require_api")
class TestDashboardTaskBuckets:
    """Корзины на главной для менеджера согласованы с правилами dashboardController."""

    def test_each_bucket_task_satisfies_rules(self, session):
        overview = _get_json(session, "/api/dashboard/overview", HEADERS_MANAGER_IVANOV)
        if overview.get("role") != "manager":
            pytest.skip("Обзор не в роли менеджера (проверьте x-user-id менеджера в config.py)")
        buckets = overview.get("taskBuckets") or {}
        now = datetime.now()
        for bucket_name in ("overdue", "today", "week"):
            for task in buckets.get(bucket_name) or []:
                assert task_matches_bucket(task, bucket_name, now=now), (
                    f"Задача id={task.get('id')} в корзине {bucket_name} не удовлетворяет правилам отбора"
                )


@pytest.mark.usefixtures("require_api")
class TestFilterPerformance:
    """Производительность клиентской фильтрации на объёме, сопоставимом с UI."""

    @staticmethod
    def _synthetic_clients(n: int) -> list[dict[str, Any]]:
        rows = []
        for i in range(1, n + 1):
            rows.append(
                {
                    "id": i,
                    "name": f"Клиент {i}",
                    "company": f"Компания {i % 50}",
                    "phone": f"+100000{i:06d}",
                    "email": f"c{i}@t.test",
                    "address": f"ул. {i}",
                    "notes": "n",
                    "managerId": (i % 5) + 1,
                }
            )
        return rows

    def test_filter_pipeline_under_budget(self):
        n = 500
        items = self._synthetic_clients(n)
        clients = _by_id(items)
        users = {k: {"id": k, "fullName": f"U{k}"} for k in range(1, 6)}
        deals: dict[int, dict[str, Any]] = {}

        iterations = 400
        t0 = time.perf_counter()
        for _ in range(iterations):
            filter_and_sort(
                "clients",
                items,
                search_text="компания 1",
                filter_field="all",
                filter_value="10",
                quick_filter="all",
                sort_field="id",
                sort_direction="desc",
                clients_by_id=clients,
                users_by_id=users,
                deals_by_id=deals,
            )
        elapsed = time.perf_counter() - t0
        per_run_ms = (elapsed / iterations) * 1000
        assert per_run_ms < 80.0, f"слишком медленно: {per_run_ms:.2f} ms за один полный цикл фильтр+сорт"


@pytest.mark.usefixtures("require_api")
class TestAllUiQuickFilterValuesExhaustive:
    """Каждый этап сделки / статус задачи из UI-констант даёт согласованный набор строк."""

    @pytest.mark.parametrize("stage", DEAL_STAGES)
    def test_deals_stage_filter_consistent(self, session, stage: str):
        items = _get_json(session, "/api/deals", HEADERS_ADMIN)
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(items)
        filtered = filter_resource_items(
            "deals",
            items,
            quick_filter=stage,
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        for it in filtered:
            assert str(it.get("stage") or "").lower().replace(" ", "_") == stage

    @pytest.mark.parametrize("status", TASK_STATUSES)
    def test_tasks_status_filter_consistent(self, session, status: str):
        items = _get_json(session, "/api/tasks", HEADERS_ADMIN)
        clients = _by_id(_get_json(session, "/api/clients", HEADERS_ADMIN))
        users = _by_id(_get_json(session, "/api/users", HEADERS_ADMIN))
        deals = _by_id(_get_json(session, "/api/deals", HEADERS_ADMIN))
        filtered = filter_resource_items(
            "tasks",
            items,
            quick_filter=status,
            clients_by_id=clients,
            users_by_id=users,
            deals_by_id=deals,
        )
        for it in filtered:
            assert str(it.get("status") or "").lower().replace(" ", "_") == status
