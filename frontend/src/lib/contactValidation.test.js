import { describe, expect, it } from "vitest";
import {
  validateBelarusLandline,
  validateBelarusPhone,
  validateClientContactPointValue,
  validateEmail,
  validateTelegram,
} from "./contactValidation.js";
describe("contactValidation", () => {
  it("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("rejects invalid email", () => {
    expect(validateEmail("bad-email")).toMatch(/почт/i);
  });

  it("accepts +375 phone", () => {
    expect(validateBelarusPhone("+375291234567")).toBeNull();
  });

  it("accepts 80 prefix phone", () => {
    expect(validateBelarusPhone("80291234567")).toBeNull();
  });

  it("rejects too short phone", () => {
    expect(validateBelarusPhone("+3752912")).toMatch(/телефон/i);
  });

  it("accepts Minsk landline", () => {
    expect(validateBelarusLandline("+375171234567")).toBeNull();
  });

  it("accepts telegram username", () => {
    expect(validateTelegram("@demo_user")).toBeNull();
  });

  it("validates contact point types", () => {
    expect(validateClientContactPointValue("website", "https://example.by")).toBeNull();
    expect(validateClientContactPointValue("vk", "vk.com/company")).toBeNull();
  });
});
