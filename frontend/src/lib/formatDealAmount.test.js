import { describe, expect, it } from "vitest";
import { formatDealAmount } from "./formatDealAmount.js";

describe("formatDealAmount", () => {
  it("форматирует в BYN, не в RUB", () => {
    const formatted = formatDealAmount(1000);
    expect(formatted).not.toContain("₽");
    expect(formatted).toMatch(/Br|BYN|р\./i);
  });

  it("пустое значение — прочерк", () => {
    expect(formatDealAmount(null)).toBe("—");
    expect(formatDealAmount("")).toBe("—");
  });
});
