import { describe, expect, it } from "vitest";
import {
  resolveContactPersonsForDisplay,
  resolveContactPointsForDisplay,
} from "./clientContactPoints.js";

describe("resolveContactPersonsForDisplay", () => {
  it("возвращает contactPersons из API", () => {
    const persons = [
      {
        fullName: "Иван",
        role: "Директор",
        channels: [{ type: "phone", value: "+375291000001" }],
      },
    ];
    expect(resolveContactPersonsForDisplay({ contactPersons: persons })).toEqual(persons);
  });

  it("группирует плоские contactPoints по contactName", () => {
    const result = resolveContactPersonsForDisplay({
      contactPoints: [
        { type: "phone", value: "+375291000001", contactName: "Иван Петров" },
        { type: "email", value: "a@b.by", contactName: "Иван Петров" },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe("Иван Петров");
    expect(result[0].channels).toHaveLength(2);
  });

  it("собирает legacy phone/email в одно лицо", () => {
    const result = resolveContactPersonsForDisplay({
      phone: "+375291000001",
      email: "demo@crm.by",
      contactPoints: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe("Основной контакт");
    expect(result[0].channels).toHaveLength(2);
  });
});

describe("resolveContactPointsForDisplay", () => {
  it("разворачивает contactPersons в плоский список", () => {
    const flat = resolveContactPointsForDisplay({
      contactPersons: [
        {
          fullName: "Stas",
          channels: [{ type: "linkedin", value: "linkedin.com/in/x" }],
        },
      ],
    });
    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({
      type: "linkedin",
      contactName: "Stas",
    });
  });
});
