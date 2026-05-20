"""
Обнаружение страниц с блоком «Фильтрация» (ResourcePanel) и фильтров дашборда.

Статический маппинг синхронизирован с frontend/src/App.jsx, UsersPage.jsx, Dashboard.jsx.
Дополнительно: парсинг исходников при переданном repo_root (проверка расхождений).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

FilterKind = Literal["resource_panel", "dashboard_task_buckets"]

_RESOURCE_FRAME_RE = re.compile(r"<ResourceFrame\s+routeKey=\"([^\"]+)\"\s*/>")


@dataclass(frozen=True)
class FilterPageSpec:
    """Страница SPA, на которой есть UI-фильтры."""

    path: str
    title: str
    kind: FilterKind
    resource_key: str | None = None
    requires_admin: bool = False


_RESOURCE_FRAME_ROUTES: tuple[FilterPageSpec, ...] = (
    FilterPageSpec("/clients", "Клиенты", "resource_panel", "clients", False),
    FilterPageSpec("/deals", "Сделки", "resource_panel", "deals", False),
    FilterPageSpec("/tasks", "Задачи", "resource_panel", "tasks", False),
    FilterPageSpec("/calls", "Звонки", "resource_panel", "calls", False),
    FilterPageSpec("/documents", "Документы", "resource_panel", "documents", False),
    FilterPageSpec("/users", "Пользователи", "resource_panel", "users", True),
)

_DASHBOARD = FilterPageSpec("/", "Главная панель", "dashboard_task_buckets", None, False)

_EXPECTED_ROUTE_KEYS = frozenset(p.resource_key for p in _RESOURCE_FRAME_ROUTES if p.resource_key)


def get_static_filter_pages() -> list[FilterPageSpec]:
    """Все страницы, где в интерфейсе есть фильтры (как в текущем React-приложении)."""
    return list(_RESOURCE_FRAME_ROUTES) + [_DASHBOARD]


def discover_filter_pages(repo_root: Path | str | None = None) -> list[FilterPageSpec]:
    """
    Возвращает страницы с фильтрами; при переданном корне репозитория сверяет routeKey в App.jsx и UsersPage.jsx.
    """
    static = get_static_filter_pages()
    if repo_root is None:
        return static

    root = Path(repo_root)
    app_path = root / "frontend" / "src" / "App.jsx"
    users_path = root / "frontend" / "src" / "pages" / "UsersPage.jsx"
    combined = ""
    if app_path.is_file():
        combined += app_path.read_text(encoding="utf-8") + "\n"
    if users_path.is_file():
        combined += users_path.read_text(encoding="utf-8") + "\n"
    if not combined.strip():
        return static

    parsed = set(_RESOURCE_FRAME_RE.findall(combined))
    if parsed != _EXPECTED_ROUTE_KEYS:
        raise RuntimeError(
            "Несовпадение ResourceFrame routeKey в исходниках и тестовом реестре.\n"
            f"  ожидалось: {sorted(_EXPECTED_ROUTE_KEYS)}\n"
            f"  в файлах: {sorted(parsed)}\n"
            "Обновите _RESOURCE_FRAME_ROUTES в tests/ui_filters/pages.py или проверьте JSX."
        )

    dash_path = root / "frontend" / "src" / "pages" / "Dashboard.jsx"
    if dash_path.is_file():
        dash = dash_path.read_text(encoding="utf-8")
        if "managerTaskBucketFilter" not in dash:
            raise RuntimeError("Dashboard.jsx: ожидался фильтр managerTaskBucketFilter.")

    return static
