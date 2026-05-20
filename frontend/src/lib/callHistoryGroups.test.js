import { describe, expect, it } from "vitest";
import { getCallDayGroupKey, getCallDayGroupLabel, groupCallsByDay } from "./callHistoryGroups.js";

describe("callHistoryGroups", () => {
  it("labels today, yesterday, day before yesterday", () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(14, 0, 0, 0);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);

    expect(getCallDayGroupKey(today.toISOString())).toBe("today");
    expect(getCallDayGroupKey(yesterday.toISOString())).toBe("yesterday");
    expect(getCallDayGroupLabel("today")).toBe("Сегодня");
    expect(getCallDayGroupLabel("yesterday")).toBe("Вчера");
    expect(getCallDayGroupLabel("dayBeforeYesterday")).toBe("Позавчера");
  });

  it("groups calls with today first", () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(12, 0, 0, 0);
    const older = new Date(now);
    older.setDate(older.getDate() - 3);

    const groups = groupCallsByDay([
      { id: 1, startedAt: older.toISOString() },
      { id: 2, startedAt: today.toISOString() },
    ]);
    expect(groups[0].key).toBe("today");
    expect(groups[0].items.map((c) => c.id)).toEqual([2]);
  });
});
