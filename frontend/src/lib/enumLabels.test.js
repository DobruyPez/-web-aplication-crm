import { describe, expect, it } from "vitest";
import {
  getCallDirectionLabel,
  getDealStageLabel,
  getEnumOptionLabel,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getUserRoleLabel,
} from "./enumLabels.js";

describe("enumLabels", () => {
  it("translates deal stages", () => {
    expect(getDealStageLabel("negotiation")).toBe("Переговоры");
  });

  it("translates task priority and status", () => {
    expect(getTaskPriorityLabel("urgent")).toBe("Срочный");
    expect(getTaskStatusLabel("in_progress")).toBe("В работе");
  });

  it("translates call enums", () => {
    expect(getCallDirectionLabel("out")).toBe("Исходящий");
    expect(getCallDirectionLabel("in")).toBe("Входящий");
  });

  it("getEnumOptionLabel for selects", () => {
    expect(getEnumOptionLabel("deals", "stage", "won")).toBe("Выиграна");
    expect(getEnumOptionLabel("tasks", "priority", "high")).toBe("Высокий");
    expect(getEnumOptionLabel("users", "role", "admin")).toBe("Администратор");
  });
});
