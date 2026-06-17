/**
 * Базовый публичный URL SPA (Meet-like ссылки).
 * Приоритет: PUBLIC_APP_URL → proto + Host из запроса.
 *
 * Типы ссылок:
 * - /client-invite/:token — контекст клиента (не видео напрямую)
 * - /calls/join/:guestToken — вход в конференцию без JWT (главная guest-ссылка)
 * - /calls/video/:sessionId — только хост-менеджер с JWT (не для клиента)
 */

const getPublicAppBaseUrl = (req) => {
  const fromEnv = process.env.PUBLIC_APP_URL && String(process.env.PUBLIC_APP_URL).trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (req) {
    const proto =
      req.secure || String(req.headers["x-forwarded-proto"] || "").includes("https") ? "https" : "http";
    const host = req.headers.host || "localhost:4000";
    return `${proto}://${host}`;
  }
  return "http://localhost:4000";
};

const buildAbsoluteUrl = (req, path) => {
  const base = getPublicAppBaseUrl(req);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

const buildJoinUrl = (req, guestToken) => buildAbsoluteUrl(req, `/calls/join/${guestToken}`);

const buildClientInviteUrl = (req, token) => buildAbsoluteUrl(req, `/client-invite/${token}`);

module.exports = {
  getPublicAppBaseUrl,
  buildAbsoluteUrl,
  buildJoinUrl,
  buildClientInviteUrl,
};
