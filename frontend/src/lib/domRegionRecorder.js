import {
  flushVideoRecordLogsToServer,
  streamTracksSummary,
  videoRecordLog,
} from "./videoRecordLogger.js";

const HAVE_CURRENT_DATA = 2;
const BG_COLOR = "#0f172a";
const PLACEHOLDER_COLOR = "#1e293b";
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const CAPTURE_FPS = 25;
const FRAME_INTERVAL_MS = Math.floor(1000 / CAPTURE_FPS);

/**
 * @param {HTMLVideoElement} video
 */
export const hasVideoFrame = (video) => {
  if (
    !video ||
    typeof video !== "object" ||
    typeof video.readyState !== "number" ||
    typeof video.videoWidth !== "number"
  ) {
    return false;
  }
  return video.readyState >= HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
};

/** @deprecated alias */
export const isVideoRecordable = hasVideoFrame;

/**
 * @param {HTMLElement} container
 */
export const getRecordSlotVideos = (container) => {
  const local = container.querySelector('[data-video-slot="local"] video');
  const remote = container.querySelector('[data-video-slot="remote"] video');
  return { local, remote, ordered: [local, remote].filter(Boolean) };
};

/** Тип стратегии захвата remote (диагностика). */
export const pickRemotePainterType = () => "dedicated-track-video";

/** RGB фона записи (#0f172a). */
export const RECORD_BG_RGB = [15, 23, 42];

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} localCanvas
 * @param {HTMLCanvasElement} remoteCanvas
 * @param {number} width
 * @param {number} height
 * @param {number} slotWidth
 */
export const mergeDualSlotCanvases = (ctx, localCanvas, remoteCanvas, width, height, slotWidth) => {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(localCanvas, 0, 0, slotWidth, height);
  ctx.drawImage(remoteCanvas, slotWidth, 0, slotWidth, height);
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} x
 * @param {number} y
 * @returns {[number, number, number]}
 */
export const sampleCanvasPixel = (canvas, x, y) => {
  const ctx = canvas.getContext("2d");
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} slotWidth
 * @param {number} height
 */
export const isSlotCanvasEmpty = (canvas, slotWidth, height) => {
  const [r, g, b] = sampleCanvasPixel(canvas, Math.floor(slotWidth / 2), Math.floor(height / 2));
  return r === RECORD_BG_RGB[0] && g === RECORD_BG_RGB[1] && b === RECORD_BG_RGB[2];
};

/**
 * @param {MediaStream|null|undefined} stream
 */
const getLiveVideoTrack = (stream) =>
  stream?.getVideoTracks()?.find((t) => t.readyState === "live" && t.enabled) ?? null;

/**
 * Отдельный <video> только для записи (1 трек = 1 элемент). Обходит баг Chrome:
 * drawImage со второго видимого WebRTC-<video> часто даёт пустой кадр.
 * @param {MediaStreamTrack} track
 */
const createDedicatedRecordVideo = (track, slotName) => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.width = 640;
  video.height = 360;
  video.style.cssText =
    "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";

  const recordStream = new MediaStream();
  let ownsTracks = false;
  let cloneOk = false;
  try {
    if (typeof track.clone === "function") {
      recordStream.addTrack(track.clone());
      ownsTracks = true;
      cloneOk = true;
    } else {
      recordStream.addTrack(track);
    }
  } catch (err) {
    recordStream.addTrack(track);
    videoRecordLog(slotName, "track.clone failed, shared track", {
      error: String(err?.message || err),
      trackId: track.id,
    });
  }

  document.body.appendChild(video);
  video.srcObject = recordStream;

  const playPromise = video.play().catch((err) => {
    videoRecordLog(slotName, "hidden video play() rejected", {
      error: String(err?.message || err),
      trackId: track.id,
    });
  });

  videoRecordLog(slotName, "dedicated record video created", {
    trackId: track.id,
    trackState: track.readyState,
    cloneOk,
    ownsTracks,
  });

  const dispose = () => {
    video.pause();
    video.srcObject = null;
    if (ownsTracks) {
      recordStream.getTracks().forEach((t) => {
        if (t.readyState !== "ended") {
          t.stop();
        }
      });
    }
    video.remove();
  };

  return { video, playPromise, dispose, recordStream };
};

/**
 * @param {HTMLVideoElement} video
 */
const paintVideoFrame = (video, ctx, w, h) => {
  if (!hasVideoFrame(video)) {
    ctx.fillStyle = PLACEHOLDER_COLOR;
    ctx.fillRect(0, 0, w, h);
    return false;
  }
  try {
    ctx.drawImage(video, 0, 0, w, h);
    return true;
  } catch {
    ctx.fillStyle = PLACEHOLDER_COLOR;
    ctx.fillRect(0, 0, w, h);
    return false;
  }
};

/**
 * Захват кадров через MediaStreamTrackProcessor (надёжнее для WebRTC remote в Chrome).
 * @param {MediaStreamTrack} track
 * @param {string} slotName
 */
const createTrackProcessorPainter = (track, slotName) => {
  if (typeof MediaStreamTrackProcessor === "undefined") {
    return null;
  }
  let reader = null;
  let latestFrame = null;
  let pumping = false;

  try {
    const processor = new MediaStreamTrackProcessor({ track });
    reader = processor.readable.getReader();
    pumping = true;
    videoRecordLog(slotName, "MediaStreamTrackProcessor started", { trackId: track.id });
    (async () => {
      while (pumping) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (latestFrame) {
          latestFrame.close();
        }
        latestFrame = value ?? null;
      }
    })().catch(() => {});
  } catch (err) {
    videoRecordLog(slotName, "MediaStreamTrackProcessor failed", {
      error: String(err?.message || err),
      trackId: track.id,
    });
    return null;
  }

  return {
    paint(ctx, w, h) {
      if (!latestFrame) {
        return false;
      }
      try {
        ctx.drawImage(latestFrame, 0, 0, w, h);
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      pumping = false;
      reader?.cancel().catch(() => {});
      if (latestFrame) {
        latestFrame.close();
        latestFrame = null;
      }
    },
  };
};

/**
 * @param {() => MediaStream|null|undefined} getStream
 * @param {number} slotWidth
 * @param {number} slotHeight
 */
const createDedicatedStreamSlot = (getStream, slotWidth, slotHeight, slotName) => {
  const slotCanvas = document.createElement("canvas");
  slotCanvas.width = slotWidth;
  slotCanvas.height = slotHeight;
  const slotCtx = slotCanvas.getContext("2d");

  let disposed = false;
  let dedicated = null;
  let processorPainter = null;
  let boundTrackId = null;
  let paintMethod = "none";
  let lastPaintAt = 0;
  let paintAttempts = 0;
  let paintSuccess = 0;
  let lastLogAt = 0;

  const bindTrack = async () => {
    const track = getLiveVideoTrack(getStream());
    if (!track || track.id === boundTrackId) {
      return Boolean(track);
    }
    if (dedicated) {
      dedicated.dispose();
      dedicated = null;
    }
    if (processorPainter) {
      processorPainter.stop();
      processorPainter = null;
    }
    processorPainter = createTrackProcessorPainter(track, slotName);
    if (processorPainter) {
      paintMethod = "track-processor";
    } else {
      dedicated = createDedicatedRecordVideo(track, slotName);
      await dedicated.playPromise;
      paintMethod = "dedicated-video";
    }
    boundTrackId = track.id;
    videoRecordLog(slotName, "bound track for recording", {
      trackId: track.id,
      paintMethod,
      stream: streamTracksSummary(getStream(), slotName),
    });
    return true;
  };

  const paint = async () => {
    if (disposed) {
      return;
    }
    const track = getLiveVideoTrack(getStream());
    if (!track) {
      slotCtx.fillStyle = PLACEHOLDER_COLOR;
      slotCtx.fillRect(0, 0, slotWidth, slotHeight);
      if (Date.now() - lastLogAt > 3000) {
        lastLogAt = Date.now();
        videoRecordLog(slotName, "no live video track", {
          stream: streamTracksSummary(getStream(), slotName),
        });
      }
      return;
    }
    if (!dedicated && !processorPainter) {
      const ok = await bindTrack();
      if (!ok) {
        return;
      }
    } else if (boundTrackId !== track.id) {
      const ok = await bindTrack();
      if (!ok) {
        return;
      }
    }
    paintAttempts += 1;
    let painted = false;
    if (processorPainter) {
      painted = processorPainter.paint(slotCtx, slotWidth, slotHeight);
      if (!painted && !dedicated) {
        dedicated = createDedicatedRecordVideo(track, slotName);
        await dedicated.playPromise;
        paintMethod = "dedicated-video-fallback";
      }
    }
    if (!painted && dedicated) {
      painted = paintVideoFrame(dedicated.video, slotCtx, slotWidth, slotHeight);
    }
    if (painted) {
      paintSuccess += 1;
      lastPaintAt = Date.now();
    }
    if (Date.now() - lastLogAt > 2000) {
      lastLogAt = Date.now();
      const v = dedicated?.video;
      videoRecordLog(slotName, "paint tick", {
        painted,
        paintMethod,
        paintAttempts,
        paintSuccess,
        videoWidth: v?.videoWidth,
        videoHeight: v?.videoHeight,
        readyState: v?.readyState,
        paused: v?.paused,
        centerRgb: painted
          ? sampleCanvasPixel(slotCanvas, Math.floor(slotWidth / 2), Math.floor(slotHeight / 2))
          : null,
      });
    }
  };

  return {
    canvas: slotCanvas,
    paint,
    rebind: bindTrack,
    slotName,
    getStats: () => ({ paintAttempts, paintSuccess, lastPaintAt, paintMethod }),
    get lastPaintAt() {
      return lastPaintAt;
    },
    stop() {
      disposed = true;
      if (processorPainter) {
        processorPainter.stop();
        processorPainter = null;
      }
      if (dedicated) {
        dedicated.dispose();
        dedicated = null;
      }
    },
  };
};

const pickMimeType = () => {
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
};

/**
 * Ждёт live video-треки и готовность скрытых recorder-video.
 * @param {MediaStream|null|undefined} localStream
 * @param {MediaStream|null|undefined} remoteStream
 * @param {number} timeoutMs
 */
export function waitForRecordingTracks(localStream, remoteStream, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    videoRecordLog("wait", "waitForRecordingTracks started", {
      local: streamTracksSummary(localStream, "local"),
      remote: streamTracksSummary(remoteStream, "remote"),
    });

    const localSlot = createDedicatedStreamSlot(() => localStream, 64, 64, "local");
    const remoteSlot = createDedicatedStreamSlot(() => remoteStream, 64, 64, "remote");

    const tick = async () => {
      const localTrack = getLiveVideoTrack(localStream);
      const remoteTrack = getLiveVideoTrack(remoteStream);
      if (!localTrack || !remoteTrack) {
        if (Date.now() >= deadline) {
          localSlot.stop();
          remoteSlot.stop();
          reject(new Error("Камеры обоих участников не готовы для записи."));
          return;
        }
        setTimeout(tick, 100);
        return;
      }

      await localSlot.rebind();
      await remoteSlot.rebind();
      await localSlot.paint();
      await remoteSlot.paint();

      const localOk = localSlot.lastPaintAt > 0;
      const remoteOk = remoteSlot.lastPaintAt > 0;

      if (localOk && remoteOk) {
        videoRecordLog("wait", "tracks ready for recording", {
          localTrackId: localTrack.id,
          remoteTrackId: remoteTrack.id,
          localStats: localSlot.getStats(),
          remoteStats: remoteSlot.getStats(),
        });
        localSlot.stop();
        remoteSlot.stop();
        resolve({ localTrack, remoteTrack });
        return;
      }

      if (Date.now() >= deadline) {
        videoRecordLog("wait", "timeout waiting for tracks", {
          localOk,
          remoteOk,
          localStats: localSlot.getStats(),
          remoteStats: remoteSlot.getStats(),
        });
        localSlot.stop();
        remoteSlot.stop();
        reject(
          new Error(
            remoteOk
              ? "Локальная камера не отдаёт кадры для записи."
              : localOk
                ? "Камера клиента не отдаёт кадры для записи."
                : "Видео для записи не готовы в отведённое время.",
          ),
        );
        return;
      }
      setTimeout(tick, 100);
    };

    tick();
  });
};

/** @deprecated use waitForRecordingTracks */
export function waitForRecordableVideos(container, options = {}) {
  const { timeoutMs = 20000 } = options;
  const { local, remote } = getRecordSlotVideos(container);
  const localStream = local?.srcObject instanceof MediaStream ? local.srcObject : null;
  const remoteStream = remote?.srcObject instanceof MediaStream ? remote.srcObject : null;
  return waitForRecordingTracks(localStream, remoteStream, timeoutMs).then(() => [local, remote]);
}

/**
 * @param {MediaStream} stream
 * @param {number} timeoutMs
 */
export function waitForVideoTrackInStream(stream, timeoutMs = 20000) {
  if (!stream) {
    return Promise.reject(new Error("Нет потока удалённого участника."));
  }
  if (getLiveVideoTrack(stream)) {
    return Promise.resolve(stream);
  }

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const check = () => {
      if (getLiveVideoTrack(stream)) {
        cleanup();
        resolve(stream);
        return;
      }
      if (Date.now() >= deadline) {
        cleanup();
        reject(new Error("Камера клиента ещё не подключена."));
        return;
      }
      requestAnimationFrame(check);
    };

    const onTrack = () => check();

    const cleanup = () => {
      stream.removeEventListener("addtrack", onTrack);
    };

    stream.addEventListener("addtrack", onTrack);
    check();
  });
}

/**
 * Запись 50%|50%: отдельные скрытые video на каждый MediaStream (надёжно в Chrome).
 * @param {HTMLElement} container — для размеров и подписей
 * @param {{
 *   audioStreams?: (MediaStream|null|undefined)[],
 *   videoStreams?: { local?: MediaStream|null, remote?: MediaStream|null },
 * }} [options]
 */
export function startDomRegionRecorder(container, options = {}) {
  const { audioStreams = [], videoStreams = {} } = options;
  const rect = container.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(Math.round(rect.width * dpr), MIN_WIDTH);
  const height = Math.max(Math.round(rect.height * dpr), MIN_HEIGHT);
  const slotWidth = Math.floor(width / 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const getLocalStream = () => videoStreams.local ?? null;
  const getRemoteStream = () => {
    const remoteVideo = container.querySelector('[data-video-slot="remote"] video');
    if (remoteVideo?.srcObject instanceof MediaStream) {
      return remoteVideo.srcObject;
    }
    return videoStreams.remote ?? null;
  };

  const localSlot = createDedicatedStreamSlot(getLocalStream, slotWidth, height, "local");
  const remoteSlot = createDedicatedStreamSlot(getRemoteStream, slotWidth, height, "remote");

  const remoteUiVideo = container.querySelector('[data-video-slot="remote"] video');
  videoRecordLog("start", "recorder started", {
    size: { width, height, slotWidth, dpr },
    mimeType: pickMimeType(),
    painter: pickRemotePainterType(),
    local: streamTracksSummary(getLocalStream(), "local"),
    remote: streamTracksSummary(getRemoteStream(), "remote"),
    remoteUiVideo: remoteUiVideo
      ? {
          videoWidth: remoteUiVideo.videoWidth,
          videoHeight: remoteUiVideo.videoHeight,
          readyState: remoteUiVideo.readyState,
          sameStreamAsRecord: remoteUiVideo.srcObject === getRemoteStream(),
        }
      : null,
  });

  let intervalId = 0;
  let running = true;
  let frameCount = 0;

  const drawLabels = () => {
    const tiles = container.querySelectorAll(".video-conf-tile-label");
    const labels = [...tiles].map((el) => el.textContent?.trim() || "");
    const leftLabel = labels[0] || "Вы";
    const rightLabel = labels[1] || "Клиент";

    const drawOne = (text, x) => {
      if (!text) return;
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(x + 8, height - 36, Math.min(slotWidth - 16, textWidth + 16), 28);
      ctx.fillStyle = "#f8fafc";
      ctx.font = `${Math.round(14 * dpr)}px Inter, system-ui, sans-serif`;
      ctx.fillText(text, x + 16, height - 16);
    };
    drawOne(leftLabel, 0);
    drawOne(rightLabel, slotWidth);
  };

  const composeFrame = async () => {
    if (!running) {
      return;
    }
    frameCount += 1;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);
    await localSlot.paint();
    await remoteSlot.paint();
    ctx.drawImage(localSlot.canvas, 0, 0, slotWidth, height);
    ctx.drawImage(remoteSlot.canvas, slotWidth, 0, slotWidth, height);
    drawLabels();
    if (frameCount === 1 || frameCount % 50 === 0) {
      videoRecordLog("compose", "frame composed", {
        frameCount,
        localLastPaint: localSlot.lastPaintAt,
        remoteLastPaint: remoteSlot.lastPaintAt,
        localCenter: sampleCanvasPixel(localSlot.canvas, Math.floor(slotWidth / 2), Math.floor(height / 2)),
        remoteCenter: sampleCanvasPixel(remoteSlot.canvas, Math.floor(slotWidth / 2), Math.floor(height / 2)),
        remoteEmpty: isSlotCanvasEmpty(remoteSlot.canvas, slotWidth, height),
      });
    }
  };

  composeFrame();
  intervalId = window.setInterval(() => {
    composeFrame();
  }, FRAME_INTERVAL_MS);

  const canvasStream = canvas.captureStream(CAPTURE_FPS);
  audioStreams
    .filter(Boolean)
    .forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        if (!canvasStream.getAudioTracks().some((t) => t.id === track.id)) {
          canvasStream.addTrack(track);
        }
      });
    });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(canvasStream, { mimeType });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start(1000);

  const stop = () =>
    new Promise((resolve) => {
      running = false;
      window.clearInterval(intervalId);
      localSlot.stop();
      remoteSlot.stop();

      videoRecordLog("stop", "recorder stopping", {
        frameCount,
        chunks: chunks.length,
        totalBytes: chunks.reduce((n, c) => n + c.size, 0),
        localStats: localSlot.getStats(),
        remoteStats: remoteSlot.getStats(),
        localCenter: sampleCanvasPixel(localSlot.canvas, Math.floor(slotWidth / 2), Math.floor(height / 2)),
        remoteCenter: sampleCanvasPixel(remoteSlot.canvas, Math.floor(slotWidth / 2), Math.floor(height / 2)),
        remoteEmpty: isSlotCanvasEmpty(remoteSlot.canvas, slotWidth, height),
        hint: "remoteEmpty=true → в файле справа будет чёрный фон",
      });

      const finalize = () => {
        const blobSize = chunks.reduce((n, c) => n + c.size, 0);
        videoRecordLog("stop", "blob ready", {
          blobSize,
          downloadLogs: "в консоли: downloadVideoRecordLogs()",
        });
        flushVideoRecordLogsToServer(`rec-${Date.now()}`).then((ok) => {
          videoRecordLog("stop", "logs flushed to server", {
            ok,
            pathHint: "backend/uploads/debug/video-record-*.json",
          });
        });
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
      if (recorder.state !== "inactive") {
        recorder.onstop = finalize;
        recorder.stop();
      } else {
        finalize();
      }
    });

  return { stop, recorder };
}
