import { DASHBOARD_DEEP_FILTER_FIELDS } from "./dashboardDeepLink.js";
import { parseListViewSearchParams } from "./listViewQuery.js";

/**
 * Состояние блока «Фильтрация» для /deals из query (без зависимости от уже загруженных items).
 */
export function deriveDealsPanelStateFromSearch(search, resourceFields) {
  const params = parseListViewSearchParams(search, "deals");
  const names = Array.isArray(resourceFields) ? resourceFields.map((f) => f.name) : [];
  const deepExtra = DASHBOARD_DEEP_FILTER_FIELDS.deals;
  const allowed = new Set(["all", "id", ...names, ...(deepExtra ? [...deepExtra] : [])]);
  let ff = params.filterField;
  let fv = params.filterValue;
  if (!allowed.has(ff)) {
    ff = "all";
    fv = "";
  }
  return {
    searchText: params.searchText ?? "",
    filterField: ff,
    filterValue: fv == null ? "" : String(fv),
    quickFilter: params.quickFilter,
    sortField: params.sortField,
    sortDirection: params.sortDirection,
  };
}
