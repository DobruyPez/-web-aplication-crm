/**
 * Редиректы с главной (и уведомлений) на страницы списков ресурсов.
 *
 * В URL передаются:
 * — recordId — id строки в таблице-источнике;
 * — filterField — поле «Поле фильтра» (как ключ в данных: id, authorId, title …);
 * — sortField, sortDirection — сортировка списка.
 *
 * Пример: /tasks?recordId=300&filterField=id&sortField=id&sortDirection=desc
 */

/** Допустимые поля фильтра по ресурсу (для валидации GET). */
export const DASHBOARD_DEEP_FILTER_FIELDS = {
  tasks: new Set(["id", "title", "authorId", "clientId", "dealId", "status", "priority", "description"]),
  deals: new Set(["id", "productName", "title", "clientId", "managerId", "stage", "amount", "description"]),
  clients: new Set(["id", "name", "email", "phone", "address", "managerId"]),
  documents: new Set(["id", "filename", "clientId", "uploaderId", "mimeType"]),
  users: new Set(["id", "fullName", "email", "role", "phone"]),
  calls: new Set(["id", "clientId", "callerId", "status", "direction"]),
};

function normalizeFilterField(resourceKey, filterField) {
  const allowed = DASHBOARD_DEEP_FILTER_FIELDS[resourceKey];
  const ff = String(filterField || "id").trim();
  if (allowed && allowed.has(ff)) {
    return ff;
  }
  return "id";
}

/**
 * @param {string} path — например "/tasks"
 * @param {object} opts
 * @param {string|number} opts.recordId — id записи в БД
 * @param {string} [opts.filterField="id"]
 * @param {string} [opts.sortField="id"]
 * @param {"asc"|"desc"} [opts.sortDirection="desc"]
 * @param {Record<string, string>} [opts.extra] — listBucket, listRisk и т.д.
 */
export function buildDashboardResourceHref(path, { recordId, filterField = "id", sortField = "id", sortDirection = "desc", extra } = {}) {
  if (recordId == null || recordId === "") {
    return path.startsWith("/") ? path : `/${path}`;
  }
  const pth = path.startsWith("/") ? path : `/${path}`;
  const resourceKey = pth.replace(/^\//, "").split("/")[0] || "tasks";
  const ff = normalizeFilterField(resourceKey, filterField);
  const q = new URLSearchParams();
  q.set("recordId", String(recordId));
  q.set("filterField", ff);
  q.set("sortField", String(sortField || "id"));
  q.set("sortDirection", sortDirection === "asc" ? "asc" : "desc");
  if (extra && typeof extra === "object") {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") {
        q.set(k, String(v));
      }
    }
  }
  return `${pth}?${q.toString()}`;
}

/**
 * @param {string} searchInner — query без ведущего «?» (как в URLSearchParams)
 * @param {string} resourceKey — clients | tasks | …
 * @returns {{ recordId: string, filterField: string, sortField: string, sortDirection: "asc"|"desc" } | null}
 */
export function parseDashboardRecordQuery(searchInner, resourceKey) {
  const params = new URLSearchParams(searchInner == null ? "" : String(searchInner));
  const recordId = params.get("recordId") ?? params.get("rid");
  if (recordId == null || String(recordId).trim() === "") {
    return null;
  }
  const filterField = normalizeFilterField(resourceKey, params.get("filterField") || "id");
  const sortFieldRaw = params.get("sortField") || "id";
  const sortField = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sortFieldRaw) ? sortFieldRaw : "id";
  const sortDirection = params.get("sortDirection") === "asc" ? "asc" : "desc";
  return {
    recordId: String(recordId).trim(),
    filterField,
    sortField,
    sortDirection,
  };
}
