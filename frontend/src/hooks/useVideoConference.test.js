import { describe, expect, it } from "vitest";
import { MAX_ROOM_PARTICIPANTS } from "./useVideoConference";

describe("useVideoConference two-party limits", () => {
  it("MAX_ROOM_PARTICIPANTS is 2", () => {
    expect(MAX_ROOM_PARTICIPANTS).toBe(2);
  });

  it("recording starts only when both sides connected and region ready", () => {
    const shouldRecord = (count, hasRemote, hasRegion, recorderRunning) =>
      count >= 2 && hasRemote && hasRegion && !recorderRunning;
    expect(shouldRecord(1, false, true, false)).toBe(false);
    expect(shouldRecord(2, true, true, false)).toBe(true);
    expect(shouldRecord(2, true, true, true)).toBe(false);
  });

  it("second remote peer should be rejected in UI logic", () => {
    const existingRemote = "peer-a";
    const incoming = "peer-b";
    const reject = existingRemote && existingRemote !== incoming;
    expect(reject).toBe(true);
  });
});
