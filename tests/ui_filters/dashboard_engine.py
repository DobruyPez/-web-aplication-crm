"""
Корзины задач менеджера на дашборде — логика как в backend/src/controllers/dashboardController.js (buildManagerOverview).

Используется локальное время (аналог new Date() в Node на той же машине), чтобы проверка совпадала с локальным API.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any


def _to_iso_day_start(d: datetime) -> datetime:
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


def _to_iso_day_end(d: datetime) -> datetime:
    return d.replace(hour=23, minute=59, second=59, microsecond=999000)


def _parse_due(raw: Any) -> datetime | None:
    if not raw:
        return None
    if isinstance(raw, datetime):
        due = raw
    else:
        s = str(raw).replace("Z", "+00:00")
        try:
            due = datetime.fromisoformat(s)
        except ValueError:
            return None
    if due.tzinfo is not None:
        due = due.astimezone().replace(tzinfo=None)
    return due


def bucket_tasks_for_manager(
    tasks: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """
    Разбивает задачи автора на overdue / today / week (как на сервере до slice).
    """
    now = now or datetime.now()
    if now.tzinfo is not None:
        now = now.astimezone().replace(tzinfo=None)

    today_start = _to_iso_day_start(now)
    today_end = _to_iso_day_end(now)
    week_end = now + timedelta(days=7)

    overdue: list[dict[str, Any]] = []
    today: list[dict[str, Any]] = []
    week: list[dict[str, Any]] = []

    for t in tasks:
        due = _parse_due(t.get("dueDate"))
        if due is None:
            continue

        status = str(t.get("status") or "")
        if due.timestamp() < now.timestamp() and status != "done":
            overdue.append(t)
        elif due >= today_start and due <= today_end:
            today.append(t)
        elif due > today_end and due <= week_end:
            week.append(t)

    return {"overdue": overdue, "today": today, "week": week}


def task_matches_bucket(task: dict[str, Any], bucket: str, *, now: datetime | None = None) -> bool:
    """Проверка: задача попадает в указанную корзину по правилам дашборда."""
    n = now or datetime.now()
    all_buckets = bucket_tasks_for_manager([task], now=n)
    return task in all_buckets.get(bucket, [])
