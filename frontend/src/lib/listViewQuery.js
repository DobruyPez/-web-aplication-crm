import { parseDashboardRecordQuery } from "./dashboardDeepLink.js";

const USER_ROLE_QUICK_FILTERS = ["admin", "manager"];

function safeDecode(value) {
  if (value == null || value === "") {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value);
  }
}

/**
 * Параметры списка из `location.search` для ResourcePanel.
 * — search: подстрока в «соломе» карточки
 * — recordId + filterField + sort*: глубокая ссылка с главной (приоритет над search)
 * — filterField / filterValue: точечный фильтр (если нет recordId)
 * — quickFilter: чип статуса / этапа / роли
 * — sortField / sortDirection: из URL (если заданы и валидны на стороне панели)
 */
export function parseListViewSearchParams(search, resourceKey) {
  const raw = search && search.startsWith("?") ? search.slice(1) : search || "";
  const params = new URLSearchParams(raw);

  const deep = parseDashboardRecordQuery(raw, resourceKey);

  let searchText = safeDecode(params.get("search"));
  let filterField = params.get("filterField") || "all";
  let filterValue = safeDecode(params.get("filterValue"));

  if (deep) {
    filterField = deep.filterField;
    filterValue = deep.recordId;
    /* Не кладём recordId в «Поиск»: haystack.match по подстроке даёт ложные совпадения (1 → 10, 11, «+7…»). */
    searchText = "";
  } else if (filterField !== "all" && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filterField)) {
    filterField = "all";
  }

  let quickFilter = "all";
  const qf = params.get("quickFilter");
  if (resourceKey === "users" && qf && USER_ROLE_QUICK_FILTERS.includes(qf)) {
    quickFilter = qf;
  }

  let sortField = null;
  let sortDirection = null;
  if (deep) {
    sortField = deep.sortField;
    sortDirection = deep.sortDirection;
  } else {
    const sf = params.get("sortField");
    if (sf && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sf)) {
      sortField = sf;
      sortDirection = params.get("sortDirection") === "asc" ? "asc" : "desc";
    }
  }

  return { searchText, filterField, filterValue, quickFilter, sortField, sortDirection };
}

/** Ссылка с query search= (для дашборда и уведомлений). */
export function buildListHref(path, searchText) {
  const s = searchText != null ? String(searchText).trim() : "";
  if (!s) {
    return path;
  }
  return `${path}?search=${encodeURIComponent(s)}`;
}

export function buildTasksBucketHref(bucket) {
  if (!["overdue", "today", "week"].includes(bucket)) {
    return "/tasks";
  }
  return `/tasks?listBucket=${bucket}`;
}

export function buildDealsRiskHref() {
  return "/deals?listRisk=1";
}

/** Ссылка на «Записи звонков» с фильтром по клиенту и сортировкой по дате (новые сверху). */
export function buildCallsClientHistoryHref(clientId) {
  if (clientId == null || clientId === "") {
    return "/calls/create";
  }
  const q = new URLSearchParams();
  q.set("filterField", "clientId");
  q.set("filterValue", String(clientId));
  q.set("sortField", "startedAt");
  q.set("sortDirection", "desc");
  return `/calls/create?${q.toString()}`;
}
