/**
 * Публичные Meet-like ссылки SPA.
 * В браузере origin берётся из window.location (текущий хост приложения).
 * VITE_PUBLIC_APP_URL — fallback для SSR/тестов без window.
 *
 * Тип 1: /client-invite/:token — контекст клиента
 * Тип 2: /calls/join/:guestToken — вход в конференцию (без JWT)
 * Тип 3: /calls/video/:sessionId — только хост-менеджер с JWT
 */

const trimSlash = (value) => String(value || "").replace(/\/$/, "");

export const PUBLIC_APP_BASE_URL =
  typeof import.meta.env.VITE_PUBLIC_APP_URL === "string" &&
  import.meta.env.VITE_PUBLIC_APP_URL.trim() !== ""
    ? trimSlash(import.meta.env.VITE_PUBLIC_APP_URL)
    : "";

/** Origin SPA: сейчас открытый в браузере хост (приоритет над .env). */
export const getAppOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return PUBLIC_APP_BASE_URL || "";
};

export const buildAbsoluteUrl = (path) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getAppOrigin();
  return base ? `${trimSlash(base)}${normalized}` : normalized;
};

export const buildJoinUrl = (guestToken) => buildAbsoluteUrl(`/calls/join/${guestToken}`);

export const buildClientInviteUrl = (token) => buildAbsoluteUrl(`/client-invite/${token}`);

/**
 * Полная ссылка на звонок из ответа API (guestJoinUrl может быть относительным).
 * @param {{ guestToken?: string, guestJoinUrl?: string, guestJoinPath?: string } | null | undefined} session
 */
export const resolveGuestJoinUrl = (session) => {
  if (!session) {
    return "";
  }
  if (session.guestToken) {
    return buildJoinUrl(session.guestToken);
  }
  const raw = session.guestJoinUrl || session.guestJoinPath || "";
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return buildAbsoluteUrl(raw);
};

/** Пути SPA без авторизации — не редиректить на /login. */
export const PUBLIC_SPA_PATH_PREFIXES = ["/client-invite/", "/calls/join/"];

export const isPublicSpaPath = (pathname) =>
  PUBLIC_SPA_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
