/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  RECORD_BG_RGB,
  getRecordSlotVideos,
  hasVideoFrame,
  isSlotCanvasEmpty,
  mergeDualSlotCanvases,
  pickRemotePainterType,
  sampleCanvasPixel,
} from "./domRegionRecorder";

function mockCanvasWithPixel(rgb) {
  return {
    width: 320,
    height: 180,
    getContext() {
      return {
        getImageData() {
          return { data: new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]) };
        },
      };
    },
  };
}

function buildRecordRegionDom() {
  const container = document.createElement("div");
  container.className = "video-conf-grid video-conf-grid-duo video-conf-record-region";
  container.innerHTML = `
    <div class="video-conf-tile" data-video-slot="local">
      <video></video>
      <span class="video-conf-tile-label">Вы</span>
    </div>
    <div class="video-conf-tile" data-video-slot="remote">
      <video></video>
      <span class="video-conf-tile-label">Клиент</span>
    </div>
  `;
  document.body.appendChild(container);
  return container;
}

describe("domRegionRecorder", () => {
  it("hasVideoFrame requires decoded dimensions", () => {
    expect(
      hasVideoFrame({
        readyState: 2,
        videoWidth: 640,
        videoHeight: 480,
        paused: true,
        currentTime: 0,
      }),
    ).toBe(true);
  });

  it("hasVideoFrame rejects empty video", () => {
    expect(
      hasVideoFrame({
        readyState: 0,
        videoWidth: 0,
        videoHeight: 0,
        paused: true,
        currentTime: 0,
      }),
    ).toBe(false);
  });

  it("getRecordSlotVideos finds local and remote slots", () => {
    const container = buildRecordRegionDom();
    const { local, remote, ordered } = getRecordSlotVideos(container);
    expect(local).toBeTruthy();
    expect(remote).toBeTruthy();
    expect(ordered).toHaveLength(2);
    container.remove();
  });

  it("pickRemotePainterType returns dedicated-track-video", () => {
    expect(pickRemotePainterType()).toBe("dedicated-track-video");
  });

  it("mergeDualSlotCanvases draws BOTH slots (regression: empty right half)", () => {
    const drawCalls = [];
    const ctx = {
      fillStyle: "",
      fillRect: () => {},
      drawImage(src, x, y, w, h) {
        drawCalls.push({ slot: src.__slot, x, y, w, h });
      },
    };
    const localSlot = { __slot: "local" };
    const remoteSlot = { __slot: "remote" };
    const width = 640;
    const height = 360;
    const slotWidth = width / 2;

    mergeDualSlotCanvases(ctx, localSlot, remoteSlot, width, height, slotWidth);

    expect(drawCalls).toHaveLength(2);
    expect(drawCalls[0]).toMatchObject({ slot: "local", x: 0 });
    expect(drawCalls[1]).toMatchObject({ slot: "remote", x: slotWidth });
  });

  it("sampleCanvasPixel reads center pixel", () => {
    const canvas = mockCanvasWithPixel([40, 90, 220]);
    expect(sampleCanvasPixel(canvas, 10, 10)).toEqual([40, 90, 220]);
  });

  it("isSlotCanvasEmpty detects blank vs filled remote slot", () => {
    const empty = mockCanvasWithPixel(RECORD_BG_RGB);
    const filled = mockCanvasWithPixel([0, 200, 100]);
    expect(isSlotCanvasEmpty(empty, 320, 180)).toBe(true);
    expect(isSlotCanvasEmpty(filled, 320, 180)).toBe(false);
  });
});
