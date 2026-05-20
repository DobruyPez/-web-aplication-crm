/**
 * Единая клиентская сортировка загруженных таблиц (CRM resource lists).
 * Используется всеми экранами с фильтрами/списками записей.
 */

export const DATE_LIKE_SORT_FIELDS = new Set([
  "closingDate",
  "dueDate",
  "startedAt",
  "endedAt",
  "createdAt",
  "updatedAt",
  "uploadedAt",
]);

export const FK_SORT_FIELD_NAMES = new Set(["clientId", "dealId", "managerId", "authorId", "callerId", "uploaderId"]);

/** Подпись связи для карточки и для сравнения при сортировке по FK. */
export function formatRef(id, map, field = "name", fallbackPrefix = "ID") {
  if (id === null || id === undefined || id === "") {
    return "—";
  }
  let entity = map?.[id];
  if (entity === undefined && id !== null && id !== "") {
    const n = parseRecordId(id);
    if (n !== null) {
      entity = map?.[n];
    }
  }
  if (!entity) {
    return `${fallbackPrefix} ${id}`;
  }
  return entity[field] || `${fallbackPrefix} ${id}`;
}

/** Целочисленный id (число или строка из цифр) — не лексикографически «100» < «49». */
export function parseRecordId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const s = String(value).trim();
  if (!/^-?\d+$/.test(s)) {
    return null;
  }
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function compareFkLabels(idA, idB, map, field) {
  const la = formatRef(idA, map, field);
  const lb = formatRef(idB, map, field);
  let c = la.localeCompare(lb, "ru", { numeric: true, sensitivity: "base" });
  if (c !== 0) {
    return c;
  }
  return la.length - lb.length;
}

/** Итог для Array.sort: только -1 | 0 | 1. */
export function signFromSortCompare(raw, sortDirection, tiebreaker) {
  const dir = sortDirection === "asc" ? 1 : -1;
  let cmp = dir * raw;
  if (!Number.isFinite(cmp)) {
    const t = tiebreaker();
    cmp = dir * t;
  }
  if (!Number.isFinite(cmp)) {
    return 0;
  }
  return cmp < 0 ? -1 : cmp > 0 ? 1 : 0;
}

/**
 * Сравнение a и b по полю sortField в логике «по возрастанию» (<0 → a раньше b).
 */
export function compareRawForSortField(a, b, sortField, ctx) {
  const { fieldMetaMap = {}, clientsById = {}, dealsById = {}, usersByIdWithCurrent = {} } = ctx;
  const meta = fieldMetaMap[sortField];
  const left = a?.[sortField];
  const right = b?.[sortField];

  const idTie = () => {
    const na = parseRecordId(a?.id);
    const nb = parseRecordId(b?.id);
    if (na !== null && nb !== null) {
      return na - nb;
    }
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), "ru", { numeric: true, sensitivity: "base" });
  };

  if (sortField === "id") {
    const nl = parseRecordId(left);
    const nr = parseRecordId(right);
    if (nl !== null && nr !== null) {
      return nl - nr;
    }
    return String(left ?? "").localeCompare(String(right ?? ""), "ru", { numeric: true, sensitivity: "base" });
  }

  if (sortField === "clientId") {
    return compareFkLabels(left, right, clientsById, "name");
  }
  if (sortField === "dealId") {
    return compareFkLabels(left, right, dealsById, "title");
  }
  if (sortField === "managerId" || sortField === "authorId" || sortField === "callerId" || sortField === "uploaderId") {
    return compareFkLabels(left, right, usersByIdWithCurrent, "fullName");
  }

  const dateLike =
    meta?.type === "date" || meta?.type === "datetime" || DATE_LIKE_SORT_FIELDS.has(sortField);
  if (dateLike) {
    const lDate = Date.parse(String(left ?? ""));
    const rDate = Date.parse(String(right ?? ""));
    if (!Number.isNaN(lDate) && !Number.isNaN(rDate)) {
      return lDate - rDate;
    }
    const sa = String(left ?? "");
    const sb = String(right ?? "");
    let c = sa.length - sb.length;
    if (c !== 0) {
      return c;
    }
    c = sa.localeCompare(sb, "ru", { numeric: true, sensitivity: "base" });
    if (c !== 0) {
      return c;
    }
    return idTie();
  }

  const numericNonFk =
    meta?.type === "decimal" ||
    sortField === "amount" ||
    sortField === "fileSize" ||
    sortField === "duration" ||
    (meta?.type === "int" && !FK_SORT_FIELD_NAMES.has(sortField));

  if (numericNonFk) {
    const nl = Number(left);
    const nr = Number(right);
    if (Number.isFinite(nl) && Number.isFinite(nr)) {
      return nl - nr;
    }
    return String(left ?? "").localeCompare(String(right ?? ""), "ru", { numeric: true, sensitivity: "base" });
  }

  const sa = String(left ?? "").trim();
  const sb = String(right ?? "").trim();
  let c = sa.length - sb.length;
  if (c !== 0) {
    return c;
  }
  c = sa.localeCompare(sb, "ru", { numeric: true, sensitivity: "base" });
  if (c !== 0) {
    return c;
  }
  return idTie();
}

/**
 * Возвращает новый массив строк, отсортированный по выбранному полю и направлению.
 *
 * @param {object[]} rows
 * @param {object} options
 * @param {string} options.sortField
 * @param {'asc'|'desc'} options.sortDirection
 * @param {Record<string, { type?: string }>} [options.fieldMetaMap]
 * @param {Record<string|number, object>} [options.clientsById]
 * @param {Record<string|number, object>} [options.dealsById]
 * @param {Record<string|number, object>} [options.usersByIdWithCurrent]
 */
export function sortLoadedRecords(rows, options) {
  const {
    sortField,
    sortDirection,
    fieldMetaMap = {},
    clientsById = {},
    dealsById = {},
    usersByIdWithCurrent = {},
  } = options;

  const ctx = { fieldMetaMap, clientsById, dealsById, usersByIdWithCurrent };
  const list = [...rows];
  list.sort((a, b) => {
    const result = compareRawForSortField(a, b, sortField, ctx);
    return signFromSortCompare(result, sortDirection, () => {
      const na = parseRecordId(a?.id);
      const nb = parseRecordId(b?.id);
      if (na !== null && nb !== null) {
        return na - nb;
      }
      return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), "ru", { numeric: true, sensitivity: "base" });
    });
  });
  return list;
}
