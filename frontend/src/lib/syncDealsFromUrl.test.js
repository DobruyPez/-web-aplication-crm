import { describe, expect, it } from "vitest";
import { deriveDealsPanelStateFromSearch } from "./syncDealsFromUrl.js";

const dealFields = [
  { name: "title", type: "string" },
  { name: "clientId", type: "int" },
  { name: "managerId", type: "int" },
];

describe("deriveDealsPanelStateFromSearch", () => {
  it("recordId + filterField из URL", () => {
    const s = deriveDealsPanelStateFromSearch("?recordId=7&filterField=id&sortField=id&sortDirection=desc", dealFields);
    expect(s.filterField).toBe("id");
    expect(s.filterValue).toBe("7");
    expect(s.sortField).toBe("id");
    expect(s.sortDirection).toBe("desc");
  });

  it("пустой query — фильтр «все»", () => {
    const s = deriveDealsPanelStateFromSearch("", dealFields);
    expect(s.filterField).toBe("all");
    expect(s.filterValue).toBe("");
  });
});
