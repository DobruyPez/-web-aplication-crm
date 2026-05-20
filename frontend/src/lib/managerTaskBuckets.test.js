import { describe, expect, it } from "vitest";
import { dealMatchesDashboardRisk, taskMatchesDashboardBucket } from "./managerTaskBuckets.js";

describe("taskMatchesDashboardBucket", () => {
  const noon = new Date("2026-05-12T12:00:00");

  it("overdue: срок в прошлом и не done", () => {
    const t = { dueDate: "2026-05-10T10:00:00.000Z", status: "new" };
    expect(taskMatchesDashboardBucket(t, "overdue", noon)).toBe(true);
  });

  it("overdue: done не попадает", () => {
    const t = { dueDate: "2026-05-10T10:00:00.000Z", status: "done" };
    expect(taskMatchesDashboardBucket(t, "overdue", noon)).toBe(false);
  });
});

describe("dealMatchesDashboardRisk", () => {
  const ref = new Date("2026-05-12T12:00:00");

  it("закрытие в окне 7 дней и не won/lost", () => {
    const d = { closingDate: "2026-05-15", stage: "proposal" };
    expect(dealMatchesDashboardRisk(d, ref)).toBe(true);
  });

  it("won не риск", () => {
    const d = { closingDate: "2026-05-15", stage: "won" };
    expect(dealMatchesDashboardRisk(d, ref)).toBe(false);
  });
});
