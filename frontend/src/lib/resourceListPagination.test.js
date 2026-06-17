import { describe, expect, it } from "vitest";
import {
  RESOURCE_LIST_PAGE_SIZE,
  paginateResourceList,
  getResourceListPageCount,
} from "./resourceListPagination.js";

describe("resourceListPagination", () => {
  const items = Array.from({ length: 70 }, (_, i) => ({ id: i + 1 }));

  it("режет список по 32 записи", () => {
    const p1 = paginateResourceList(items, 1);
    expect(p1.items).toHaveLength(32);
    expect(p1.rangeStart).toBe(1);
    expect(p1.rangeEnd).toBe(32);

    const p2 = paginateResourceList(items, 2);
    expect(p2.items).toHaveLength(32);
    expect(p2.rangeStart).toBe(33);
    expect(p2.rangeEnd).toBe(64);

    const p3 = paginateResourceList(items, 3);
    expect(p3.items).toHaveLength(6);
    expect(p3.pageCount).toBe(3);
  });

  it("сжимает страницу, если после фильтра записей меньше", () => {
    const few = items.slice(0, 10);
    const result = paginateResourceList(few, 5);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(10);
    expect(getResourceListPageCount(10, RESOURCE_LIST_PAGE_SIZE)).toBe(1);
  });
});
