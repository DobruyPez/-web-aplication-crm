import { describe, expect, it } from "vitest";
import {
  buildCallsClientHistoryHref,
  buildDealsRiskHref,
  buildTasksBucketHref,
  parseListViewSearchParams,
} from "./listViewQuery.js";

describe("parseListViewSearchParams + recordId", () => {
  it("recordId выставляет поле фильтра и значение (поиск не дублирует recordId)", () => {
    const q = "recordId=300&filterField=id&sortField=id&sortDirection=desc";
    const p = parseListViewSearchParams(`?${q}`, "tasks");
    expect(p.searchText).toBe("");
    expect(p.filterField).toBe("id");
    expect(p.filterValue).toBe("300");
    expect(p.sortField).toBe("id");
    expect(p.sortDirection).toBe("desc");
  });

  it("deep link deals: пустой поиск, фильтр по id", () => {
    const q = "recordId=5&filterField=id&sortField=id&sortDirection=desc";
    const p = parseListViewSearchParams(`?${q}`, "deals");
    expect(p.searchText).toBe("");
    expect(p.filterField).toBe("id");
    expect(p.filterValue).toBe("5");
  });

  it("deep link: sortDirection asc", () => {
    const q = "recordId=1&filterField=id&sortField=title&sortDirection=asc";
    const p = parseListViewSearchParams(`?${q}`, "tasks");
    expect(p.sortField).toBe("title");
    expect(p.sortDirection).toBe("asc");
  });

  it("читает search для задач (quickFilter по статусу отключён)", () => {
    const q = "?search=" + encodeURIComponent("Тест") + "&quickFilter=done";
    const p = parseListViewSearchParams(q, "tasks");
    expect(p.searchText).toBe("Тест");
    expect(p.quickFilter).toBe("all");
  });
});

describe("buildTasksBucketHref / buildDealsRiskHref", () => {
  it("корзины задач", () => {
    expect(buildTasksBucketHref("overdue")).toBe("/tasks?listBucket=overdue");
    expect(buildTasksBucketHref("bad")).toBe("/tasks");
  });

  it("риск сделок", () => {
    expect(buildDealsRiskHref()).toBe("/deals?listRisk=1");
  });

  it("история звонков клиента", () => {
    const href = buildCallsClientHistoryHref(42);
    expect(href).toContain("/calls/create?");
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("filterField")).toBe("clientId");
    expect(params.get("filterValue")).toBe("42");
    expect(params.get("sortField")).toBe("startedAt");
    expect(params.get("sortDirection")).toBe("desc");
  });
});
