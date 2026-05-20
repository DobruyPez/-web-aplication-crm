#!/usr/bin/env python3
"""
Скрипт: выводит все страницы SPA, на которых есть фильтры (как в CRM-фронтенде).

Запуск из каталога tests:
  python list_ui_filter_pages.py

Или из корня репозитория:
  python tests/list_ui_filter_pages.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_TESTS_DIR = Path(__file__).resolve().parent
if str(_TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(_TESTS_DIR))

from ui_filters.pages import FilterPageSpec, discover_filter_pages, get_static_filter_pages  # noqa: E402


def _print_rows(pages: list[FilterPageSpec]) -> None:
    print(f"{'path':<22} {'title':<26} {'kind':<28} {'resource':<12} admin-only")
    print("-" * 100)
    for p in pages:
        rk = p.resource_key or "—"
        adm = "yes" if p.requires_admin else "no"
        print(f"{p.path:<22} {p.title:<26} {p.kind:<28} {rk:<12} {adm}")


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, OSError):
        pass
    repo_root = _TESTS_DIR.parent
    try:
        pages = discover_filter_pages(repo_root)
        source = f"discover_filter_pages({repo_root})"
    except RuntimeError as e:
        print(f"WARN: {e}\nFallback: статический список.\n")
        pages = get_static_filter_pages()
        source = "get_static_filter_pages()"

    print(f"Страницы с фильтрами ({len(pages)}), источник: {source}\n")
    _print_rows(pages)


if __name__ == "__main__":
    main()
