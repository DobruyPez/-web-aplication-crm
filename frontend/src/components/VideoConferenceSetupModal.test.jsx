import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseClientInviteToken } from "../lib/clientInviteLink";

vi.mock("../api", () => ({
  fetchList: vi.fn(async () => [{ id: 1, name: "Клиент А" }]),
  fetchClientInvitePublic: vi.fn(async () => ({
    clientName: "Клиент 302",
    managerName: "Тестовый пользователь 2",
  })),
  createVideoSession: vi.fn(async (payload) => ({
    sessionId: "sess-1",
    id: "sess-1",
    direction: payload.clientInviteUrl ? "in" : "out",
    clientId: payload.clientId,
    guestToken: "abc123",
  })),
}));

import { createVideoSession } from "../api";

describe("VideoConferenceSetupModal payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends clientId for outgoing session", async () => {
    await createVideoSession({ clientId: 5 });
    expect(createVideoSession).toHaveBeenCalledWith({ clientId: 5 });
  });

  it("sends clientInviteUrl for incoming session", async () => {
    const url = "https://localhost:4443/client-invite/d2bda004c8391ed3";
    await createVideoSession({ clientInviteUrl: url });
    expect(createVideoSession).toHaveBeenCalledWith({ clientInviteUrl: url });
  });
});

describe("parseClientInviteToken", () => {
  it("extracts token from absolute url", () => {
    expect(parseClientInviteToken("https://localhost:4443/client-invite/abc123def")).toBe("abc123def");
  });

  it("extracts token from path", () => {
    expect(parseClientInviteToken("/client-invite/xyz")).toBe("xyz");
  });
});
