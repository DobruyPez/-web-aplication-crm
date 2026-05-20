import { describe, expect, it } from "vitest";
import { toAppLocation } from "./appLocation.js";

describe("toAppLocation", () => {
  it("возвращает строку без query", () => {
    expect(toAppLocation("/deals")).toBe("/deals");
  });

  it("разбивает pathname и search", () => {
    expect(toAppLocation("/deals?recordId=1&filterField=id")).toEqual({
      pathname: "/deals",
      search: "?recordId=1&filterField=id",
    });
  });

  it("корень с query", () => {
    expect(toAppLocation("/?x=1")).toEqual({ pathname: "/", search: "?x=1" });
  });
});
