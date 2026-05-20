import { describe, expect, it } from "vitest";
import { buildDashboardResourceHref, parseDashboardRecordQuery } from "./dashboardDeepLink.js";

describe("buildDashboardResourceHref", () => {
  it("формирует query с recordId, filterField, сортировкой", () => {
    const href = buildDashboardResourceHref("/tasks", { recordId: 300, filterField: "id" });
    expect(href).toContain("recordId=300");
    expect(href).toContain("filterField=id");
    expect(href).toContain("sortField=id");
    expect(href).toContain("sortDirection=desc");
  });

  it("добавляет extra-параметры", () => {
    const href = buildDashboardResourceHref("/tasks", {
      recordId: 1,
      filterField: "id",
      extra: { listBucket: "overdue" },
    });
    expect(href).toContain("listBucket=overdue");
  });
});

describe("parseDashboardRecordQuery", () => {
  it("парсит внутреннюю строку query", () => {
    const q = "recordId=300&filterField=id&sortField=id&sortDirection=desc";
    const d = parseDashboardRecordQuery(q, "tasks");
    expect(d).toEqual({
      recordId: "300",
      filterField: "id",
      sortField: "id",
      sortDirection: "desc",
    });
  });

  it("null без recordId", () => {
    expect(parseDashboardRecordQuery("search=foo", "tasks")).toBe(null);
  });
});
