export const RESOURCE_LIST_PAGE_SIZE = 32;

export function getResourceListPageCount(total, pageSize = RESOURCE_LIST_PAGE_SIZE) {
  const n = Number(total) || 0;
  if (n <= 0) {
    return 1;
  }
  return Math.ceil(n / pageSize);
}

export function clampResourceListPage(page, pageCount) {
  const max = Math.max(1, Number(pageCount) || 1);
  const p = Number(page) || 1;
  if (p < 1) {
    return 1;
  }
  if (p > max) {
    return max;
  }
  return p;
}

export function paginateResourceList(items, page, pageSize = RESOURCE_LIST_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const pageCount = getResourceListPageCount(list.length, pageSize);
  const currentPage = clampResourceListPage(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  return {
    page: currentPage,
    pageCount,
    total: list.length,
    items: list.slice(start, start + pageSize),
    rangeStart: list.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, list.length),
  };
}
