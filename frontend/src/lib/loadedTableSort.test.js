import { describe, expect, it } from "vitest";
import { compareRawForSortField, formatRef, parseRecordId, sortLoadedRecords } from "./loadedTableSort.js";

describe("formatRef", () => {
  it("находит сущность по строковому id при числовых ключах карты", () => {
    const map = { 2: { id: 2, fullName: "Иван" } };
    expect(formatRef("2", map, "fullName")).toBe("Иван");
  });
});

describe("parseRecordId", () => {
  it("нормализует строковые id в целые", () => {
    expect(parseRecordId("100")).toBe(100);
    expect(parseRecordId("49")).toBe(49);
    expect(parseRecordId(12)).toBe(12);
  });

  it("возвращает null для пустых и нечисловых", () => {
    expect(parseRecordId("")).toBe(null);
    expect(parseRecordId(null)).toBe(null);
    expect(parseRecordId("x1")).toBe(null);
  });
});

describe("sortLoadedRecords по id", () => {
  it("по возрастанию — числовой порядок, а не строковый (100 после 49)", () => {
    const rows = [
      { id: "100", name: "a" },
      { id: "49", name: "b" },
      { id: "9", name: "c" },
    ];
    const sorted = sortLoadedRecords(rows, {
      sortField: "id",
      sortDirection: "asc",
      fieldMetaMap: {},
    });
    expect(sorted.map((r) => r.id)).toEqual(["9", "49", "100"]);
  });

  it("по убыванию — первым идёт максимальный id", () => {
    const rows = [
      { id: 3, name: "c" },
      { id: 500, name: "x" },
      { id: 1, name: "a" },
    ];
    const sorted = sortLoadedRecords(rows, {
      sortField: "id",
      sortDirection: "desc",
      fieldMetaMap: {},
    });
    expect(sorted.map((r) => r.id)).toEqual([500, 3, 1]);
  });
});

describe("sortLoadedRecords по FK (managerId)", () => {
  it("сортирует по ФИО, а не по числовому managerId", () => {
    const usersByIdWithCurrent = {
      1: { id: 1, fullName: "Яшин" },
      2: { id: 2, fullName: "Антонов" },
    };
    const rows = [
      { id: 10, managerId: 1 },
      { id: 11, managerId: 2 },
    ];
    const asc = sortLoadedRecords(rows, {
      sortField: "managerId",
      sortDirection: "asc",
      fieldMetaMap: {},
      usersByIdWithCurrent,
    });
    expect(asc.map((r) => r.managerId)).toEqual([2, 1]);
  });
});

describe("sortLoadedRecords по текстовому полю", () => {
  it("сначала по длине строки, затем по алфавиту", () => {
    const rows = [
      { id: 1, name: "abcd" },
      { id: 2, name: "ab" },
      { id: 3, name: "yy" },
    ];
    const sorted = sortLoadedRecords(rows, {
      sortField: "name",
      sortDirection: "asc",
      fieldMetaMap: { name: { type: "string" } },
    });
    expect(sorted.map((r) => r.name)).toEqual(["ab", "yy", "abcd"]);
  });
});

describe("compareRawForSortField", () => {
  it("amount как число", () => {
    const ctx = { fieldMetaMap: { amount: { type: "decimal" } } };
    const a = { id: 1, amount: "12.5" };
    const b = { id: 2, amount: "100" };
    expect(compareRawForSortField(a, b, "amount", ctx)).toBeLessThan(0);
  });
});
