import { API_BASE_URL } from "../config.js";

const LOG_KEY = "crm_video_record_log_v1";
const MAX_ENTRIES = 400;

const readStore = () => {
  try {
    const raw = sessionStorage.getItem(LOG_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStore = (entries) => {
  try {
    sessionStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota / private mode */
  }
};

/**
 * @param {string} phase
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
export const videoRecordLog = (phase, message, data = {}) => {
  const entry = {
    t: new Date().toISOString(),
    phase,
    message,
    data,
  };

  const buf = readStore();
  buf.push(entry);
  writeStore(buf);

  if (typeof window !== "undefined") {
    if (!window.__videoRecordLogs) {
      window.__videoRecordLogs = [];
    }
    window.__videoRecordLogs.push(entry);
    if (window.__videoRecordLogs.length > MAX_ENTRIES) {
      window.__videoRecordLogs.shift();
    }
  }

  const payload = data && Object.keys(data).length > 0 ? data : "";
  console.info(`[VideoRecord][${phase}]`, message, payload);

  if (typeof window !== "undefined" && window.__VIDEO_RECORD_DEBUG__) {
    fetch(`${API_BASE_URL.replace(/\/$/, "")}/debug-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "video-record", ...entry }),
      keepalive: true,
    }).catch(() => {});
  }
};

export const getVideoRecordLogs = () => {
  if (typeof window !== "undefined" && window.__videoRecordLogs?.length) {
    return [...window.__videoRecordLogs];
  }
  return readStore();
};

export const clearVideoRecordLogs = () => {
  try {
    sessionStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.__videoRecordLogs = [];
  }
};

/** Сохранить весь лог на сервер (uploads/debug/) — после звонка менеджера. */
export const flushVideoRecordLogsToServer = async (sessionId) => {
  const logs = getVideoRecordLogs();
  if (!logs.length || typeof window === "undefined") {
    return false;
  }
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/debug-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "video-record-batch",
        sessionId: sessionId || Date.now(),
        entries: logs,
      }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const downloadVideoRecordLogs = () => {
  const logs = getVideoRecordLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `video-record-log-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const isVideoRecordDebugEnabled = () => {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.__VIDEO_RECORD_DEBUG__) {
    return true;
  }
  try {
    return (
      localStorage.getItem("VIDEO_RECORD_DEBUG") === "1" ||
      sessionStorage.getItem("VIDEO_RECORD_DEBUG") === "1" ||
      new URLSearchParams(window.location.search).has("videoRecordDebug")
    );
  } catch {
    return new URLSearchParams(window.location.search).has("videoRecordDebug");
  }
};

export const logRecordingEnvironment = () => {
  if (typeof window === "undefined") {
    return;
  }
  let sessionStorageOk = true;
  try {
    sessionStorage.setItem("__vr_test", "1");
    sessionStorage.removeItem("__vr_test");
  } catch {
    sessionStorageOk = false;
  }
  videoRecordLog("env", "browser context", {
    userAgent: navigator.userAgent,
    cookieEnabled: navigator.cookieEnabled,
    sessionStorageOk,
    href: window.location.href,
    isIncognitoHint:
      "В инкогнито guest-вкладка нормальна; запись ведёт только вкладка менеджера. На одном ПК обе вкладки часто делят одну камеру.",
  });
};

export const streamTracksSummary = (stream, label) => {
  if (!stream) {
    return { label, present: false };
  }
  return {
    label,
    present: true,
    video: stream.getVideoTracks().map((t) => ({
      id: t.id,
      state: t.readyState,
      enabled: t.enabled,
      muted: t.muted,
      label: t.label,
    })),
    audio: stream.getAudioTracks().length,
  };
};

export const initVideoRecordDebug = () => {
  if (typeof window === "undefined") {
    return;
  }
  if (isVideoRecordDebugEnabled()) {
    window.__VIDEO_RECORD_DEBUG__ = true;
  }
  window.downloadVideoRecordLogs = downloadVideoRecordLogs;
  window.getVideoRecordLogs = getVideoRecordLogs;
  window.clearVideoRecordLogs = clearVideoRecordLogs;
  logRecordingEnvironment();
};
