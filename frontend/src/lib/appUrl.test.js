import { afterEach, describe, expect, it, vi } from "vitest";
import { buildJoinUrl, resolveGuestJoinUrl } from "./appUrl.js";

describe("appUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("buildJoinUrl uses current window origin", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://localhost:4443" },
    });
    expect(buildJoinUrl("tok123")).toBe("https://localhost:4443/calls/join/tok123");
  });

  it("resolveGuestJoinUrl prefers guestToken over relative guestJoinUrl", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://192.168.1.10:443" },
    });
    expect(
      resolveGuestJoinUrl({
        guestToken: "abc",
        guestJoinUrl: "/calls/join/abc",
      }),
    ).toBe("https://192.168.1.10:443/calls/join/abc");
  });

  it("resolveGuestJoinUrl keeps absolute guestJoinUrl when no token", () => {
    expect(
      resolveGuestJoinUrl({
        guestJoinUrl: "https://crm.example.com/calls/join/xyz",
      }),
    ).toBe("https://crm.example.com/calls/join/xyz");
  });
});
