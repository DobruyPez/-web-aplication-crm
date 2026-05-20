"""
Клиентская фильтрация списков (как в frontend/src/components/ResourcePanel.jsx):
поиск по «соломе», поле+значение, быстрые чипы, сортировка.
"""

from __future__ import annotations

import re
from functools import cmp_to_key
from typing import Any

from .constants import DEAL_STAGES, TASK_STATUSES, USER_ROLE_QUICK_FILTERS


def normalize_enum(value: Any) -> str:
    return re.sub(r"\s+", "_", str(value or "").strip().lower())


def prettify(value: Any) -> str:
    s = str(value or "")
    s = s.replace("_", " ")
    if not s:
        return ""
    return s[0].upper() + s[1:] if len(s) > 1 else s.upper()


def format_ref(
    fk_id: Any,
    entity_map: dict[int, dict[str, Any]],
    field: str = "name",
    fallback_prefix: str = "ID",
) -> str:
    if fk_id is None or fk_id == "":
        return ""
    try:
        iid = int(fk_id)
    except (TypeError, ValueError):
        return str(fk_id)
    entity = entity_map.get(iid)
    if not entity:
        return f"{fallback_prefix} {iid}"
    val = entity.get(field)
    return str(val) if val else f"{fallback_prefix} {iid}"


def _card_row_string_parts(
    resource_key: str,
    item: dict[str, Any],
    clients_by_id: dict[int, dict[str, Any]],
    users_by_id: dict[int, dict[str, Any]],
    deals_by_id: dict[int, dict[str, Any]],
) -> list[str]:
    """Строковые части карточки, участвующие в поиске (аналог getCardRows → string/number)."""

    def money(v: Any) -> str:
        if v is None or v == "":
            return ""
        try:
            n = float(v)
        except (TypeError, ValueError):
            return str(v)
        return f"{n:,.0f}".replace(",", " ")

    parts: list[str] = []
    if resource_key == "clients":
        parts.extend(
            [
                str(item.get("name") or ""),
                str(item.get("company") or ""),
                str(item.get("phone") or ""),
                str(item.get("email") or ""),
                str(item.get("address") or ""),
                format_ref(item.get("managerId"), users_by_id, "fullName"),
                str(item.get("notes") or ""),
            ]
        )
    elif resource_key == "deals":
        parts.extend(
            [
                str(item.get("title") or ""),
                prettify(item.get("stage") or "new"),
                money(item.get("amount")),
                str(item.get("closingDate") or ""),
                format_ref(item.get("clientId"), clients_by_id, "name"),
                format_ref(item.get("managerId"), users_by_id, "fullName"),
                str(item.get("description") or ""),
            ]
        )
    elif resource_key == "tasks":
        parts.extend(
            [
                str(item.get("title") or ""),
                prettify(item.get("status") or "new"),
                prettify(item.get("priority") or "medium"),
                str(item.get("dueDate") or ""),
                format_ref(item.get("authorId"), users_by_id, "fullName"),
                format_ref(item.get("clientId"), clients_by_id, "name"),
                format_ref(item.get("dealId"), deals_by_id, "title"),
                str(item.get("description") or ""),
            ]
        )
    elif resource_key == "documents":
        parts.extend(
            [
                str(item.get("filename") or ""),
                str(item.get("filePath") or ""),
                format_ref(item.get("clientId"), clients_by_id, "name"),
                format_ref(item.get("uploaderId"), users_by_id, "fullName"),
                str(item.get("fileSize") if item.get("fileSize") is not None else ""),
                str(item.get("mimeType") or ""),
                str(item.get("uploadedAt") or ""),
            ]
        )
    elif resource_key == "calls":
        parts.extend(
            [
                format_ref(item.get("clientId"), clients_by_id, "name"),
                format_ref(item.get("callerId"), users_by_id, "fullName"),
                str(item.get("direction") or ""),
                str(item.get("status") or ""),
                str(item.get("duration") if item.get("duration") is not None else ""),
                str(item.get("startedAt") or ""),
                str(item.get("endedAt") or ""),
            ]
        )
    elif resource_key == "users":
        parts.extend(
            [
                str(item.get("fullName") or ""),
                str(item.get("email") or ""),
                prettify(item.get("role") or "manager"),
                str(item.get("phone") or ""),
                str(item.get("telegramLink") or ""),
                str(item.get("telegramChatId") or ""),
                str(item.get("createdAt") or ""),
            ]
        )
    return parts


def build_search_haystack(
    resource_key: str,
    item: dict[str, Any],
    clients_by_id: dict[int, dict[str, Any]],
    users_by_id: dict[int, dict[str, Any]],
    deals_by_id: dict[int, dict[str, Any]],
) -> str:
    flat_vals = [str(val if val is not None else "") for val in (item or {}).values()]
    card_bits = _card_row_string_parts(resource_key, item, clients_by_id, users_by_id, deals_by_id)
    return (" ".join(flat_vals + card_bits)).lower()


def _quick_filter_meta(resource_key: str, quick_filter: str) -> tuple[str, str] | None:
    if quick_filter == "all":
        return None
    if resource_key == "tasks" and quick_filter in TASK_STATUSES:
        return "status", quick_filter
    if resource_key == "deals" and quick_filter in DEAL_STAGES:
        return "stage", quick_filter
    if resource_key == "users" and quick_filter in USER_ROLE_QUICK_FILTERS:
        return "role", quick_filter
    return None


def item_passes_filters(
    resource_key: str,
    item: dict[str, Any],
    *,
    search_text: str,
    filter_field: str,
    filter_value: str,
    quick_filter: str,
    clients_by_id: dict[int, dict[str, Any]],
    users_by_id: dict[int, dict[str, Any]],
    deals_by_id: dict[int, dict[str, Any]],
) -> bool:
    q = search_text.strip().lower()
    ff = filter_field
    fv = filter_value.strip().lower()

    hay = build_search_haystack(resource_key, item, clients_by_id, users_by_id, deals_by_id)
    if q and q not in hay:
        return False

    if fv:
        if ff == "all":
            if not any(str(v if v is not None else "").lower().find(fv) >= 0 for v in (item or {}).values()):
                return False
        else:
            field_val = item.get(ff)
            fv_trim = filter_value.strip()
            id_like = ff == "id" or (isinstance(ff, str) and ff.endswith("Id"))
            digits_only = fv_trim.isdigit()
            if id_like and digits_only:
                try:
                    n_cell = int(field_val) if field_val is not None and str(field_val).strip() != "" else None
                except (TypeError, ValueError):
                    n_cell = None
                n_fv = int(fv_trim)
                if n_cell is None or n_cell != n_fv:
                    return False
            else:
                if str(field_val if field_val is not None else "").lower().find(fv) < 0:
                    return False

    qm = _quick_filter_meta(resource_key, quick_filter)
    if qm:
        field, expected = qm
        if normalize_enum(item.get(field)) != expected:
            return False
    return True


def filter_resource_items(
    resource_key: str,
    items: list[dict[str, Any]],
    *,
    search_text: str = "",
    filter_field: str = "all",
    filter_value: str = "",
    quick_filter: str = "all",
    clients_by_id: dict[int, dict[str, Any]] | None = None,
    users_by_id: dict[int, dict[str, Any]] | None = None,
    deals_by_id: dict[int, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    cb = clients_by_id or {}
    ub = users_by_id or {}
    db = deals_by_id or {}
    return [
        it
        for it in items
        if item_passes_filters(
            resource_key,
            it,
            search_text=search_text,
            filter_field=filter_field,
            filter_value=filter_value,
            quick_filter=quick_filter,
            clients_by_id=cb,
            users_by_id=ub,
            deals_by_id=db,
        )
    ]


_FK_LABEL_SORT_FIELDS = frozenset(
    {"clientId", "managerId", "authorId", "callerId", "dealId", "uploaderId"},
)

_DATE_LIKE_SORT_FIELDS = frozenset(
    ("closingDate", "dueDate", "startedAt", "endedAt", "createdAt", "updatedAt", "uploadedAt")
)

_NUMERIC_NON_FK_FIELDS = frozenset({"amount", "fileSize", "duration"})


def _fk_sort_display_label(
    item: dict[str, Any],
    sort_field: str,
    clients_by_id: dict[int, dict[str, Any]],
    users_by_id: dict[int, dict[str, Any]],
    deals_by_id: dict[int, dict[str, Any]],
) -> str:
    if sort_field == "clientId":
        return format_ref(item.get("clientId"), clients_by_id, "name") or "—"
    if sort_field == "dealId":
        return format_ref(item.get("dealId"), deals_by_id, "title") or "—"
    if sort_field in ("managerId", "authorId", "callerId", "uploaderId"):
        return format_ref(item.get(sort_field), users_by_id, "fullName") or "—"
    return "—"


def _parse_ts(value: Any) -> float | None:
    if value is None or value == "":
        return None
    from datetime import datetime

    try:
        s = str(value).replace("Z", "+00:00")
        d = datetime.fromisoformat(s)
        return d.timestamp()
    except Exception:
        return None


def _parse_record_id(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value == value:
        return int(value) if value == int(value) else None
    s = str(value).strip()
    if not s or not re.fullmatch(r"-?\d+", s):
        return None
    try:
        return int(s, 10)
    except ValueError:
        return None


def _id_tie(a: dict[str, Any], b: dict[str, Any]) -> int:
    na = _parse_record_id(a.get("id"))
    nb = _parse_record_id(b.get("id"))
    if na is not None and nb is not None:
        if na != nb:
            return (na > nb) - (na < nb)
        return 0
    sa = str(a.get("id") or "")
    sb = str(b.get("id") or "")
    return (sa > sb) - (sa < sb)


def _compare_fk_labels(
    a: dict[str, Any],
    b: dict[str, Any],
    sort_field: str,
    cb: dict[int, dict[str, Any]],
    ub: dict[int, dict[str, Any]],
    db: dict[int, dict[str, Any]],
) -> int:
    la = _fk_sort_display_label(a, sort_field, cb, ub, db)
    lb = _fk_sort_display_label(b, sort_field, cb, ub, db)
    if la != lb:
        return (la > lb) - (la < lb)
    ln = len(la) - len(lb)
    if ln != 0:
        return ln
    return 0


def compare_raw_for_sort_field(
    a: dict[str, Any],
    b: dict[str, Any],
    sort_field: str,
    *,
    clients_by_id: dict[int, dict[str, Any]],
    users_by_id: dict[int, dict[str, Any]],
    deals_by_id: dict[int, dict[str, Any]],
    field_meta: dict[str, dict[str, Any]] | None = None,
) -> float:
    """Сырой результат сравнения при сортировке по возрастанию (как compareRawForSortField в React)."""
    meta = (field_meta or {}).get(sort_field) or {}
    mtype = meta.get("type")
    left = a.get(sort_field)
    right = b.get(sort_field)

    if sort_field == "id":
        nl = _parse_record_id(left)
        nr = _parse_record_id(right)
        if nl is not None and nr is not None:
            return float(nl - nr)
        sa = str(left if left is not None else "")
        sb = str(right if right is not None else "")
        if sa != sb:
            return float((sa > sb) - (sa < sb))
        return 0.0

    if sort_field in _FK_LABEL_SORT_FIELDS:
        return float(_compare_fk_labels(a, b, sort_field, clients_by_id, users_by_id, deals_by_id))

    date_like = mtype in ("date", "datetime") or sort_field in _DATE_LIKE_SORT_FIELDS
    if date_like:
        l_date = _parse_ts(left)
        r_date = _parse_ts(right)
        if l_date is not None and r_date is not None:
            return l_date - r_date
        sa = str(left if left is not None else "")
        sb = str(right if right is not None else "")
        ln = len(sa) - len(sb)
        if ln != 0:
            return float(ln)
        c = (sa > sb) - (sa < sb) if sa != sb else 0.0
        if c != 0:
            return float(c)
        return float(_id_tie(a, b))

    numeric_non_fk = mtype == "decimal" or sort_field in _NUMERIC_NON_FK_FIELDS or (
        mtype == "int" and sort_field not in _FK_LABEL_SORT_FIELDS
    )
    if numeric_non_fk:
        try:
            nl = float(left)
            nr = float(right)
            if nl == nl and nr == nr:
                return nl - nr
        except (TypeError, ValueError):
            pass
        sa = str(left if left is not None else "")
        sb = str(right if right is not None else "")
        return float((sa > sb) - (sa < sb)) if sa != sb else 0.0

    sa = str(left if left is not None else "").strip()
    sb = str(right if right is not None else "").strip()
    ln = len(sa) - len(sb)
    if ln != 0:
        return float(ln)
    if sa < sb:
        c = -1.0
    elif sa > sb:
        c = 1.0
    else:
        c = 0.0
    if c != 0:
        return c
    return float(_id_tie(a, b))


def apply_sort(
    items: list[dict[str, Any]],
    sort_field: str,
    sort_direction: str,
    *,
    clients_by_id: dict[int, dict[str, Any]] | None = None,
    users_by_id: dict[int, dict[str, Any]] | None = None,
    deals_by_id: dict[int, dict[str, Any]] | None = None,
    field_meta: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    cb = clients_by_id or {}
    ub = users_by_id or {}
    db = deals_by_id or {}

    def compare(a: dict[str, Any], b: dict[str, Any]) -> int:
        raw = compare_raw_for_sort_field(a, b, sort_field, clients_by_id=cb, users_by_id=ub, deals_by_id=db, field_meta=field_meta)
        if sort_direction == "desc":
            raw = -raw
        if raw != raw:  # NaN
            raw = 0.0
        return (raw > 0) - (raw < 0)

    return sorted(items, key=cmp_to_key(compare))


def filter_and_sort(
    resource_key: str,
    items: list[dict[str, Any]],
    *,
    search_text: str = "",
    filter_field: str = "all",
    filter_value: str = "",
    quick_filter: str = "all",
    sort_field: str = "id",
    sort_direction: str = "desc",
    clients_by_id: dict[int, dict[str, Any]] | None = None,
    users_by_id: dict[int, dict[str, Any]] | None = None,
    deals_by_id: dict[int, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    filtered = filter_resource_items(
        resource_key,
        items,
        search_text=search_text,
        filter_field=filter_field,
        filter_value=filter_value,
        quick_filter=quick_filter,
        clients_by_id=clients_by_id,
        users_by_id=users_by_id,
        deals_by_id=deals_by_id,
    )
    return apply_sort(
        filtered,
        sort_field,
        sort_direction,
        clients_by_id=clients_by_id,
        users_by_id=users_by_id,
        deals_by_id=deals_by_id,
    )


def quick_filter_values_for_resource(resource_key: str) -> list[str]:
    """Все значения быстрого фильтра, включая «all»."""
    if resource_key == "tasks":
        return ["all", *TASK_STATUSES]
    if resource_key == "deals":
        return ["all", *DEAL_STAGES]
    if resource_key == "users":
        return ["all", *USER_ROLE_QUICK_FILTERS]
    return ["all"]
