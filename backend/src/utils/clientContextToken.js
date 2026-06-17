const INVITE_PATH_RE = /\/client-invite\/([a-zA-Z0-9_-]+)/i;

/**
 * Извлекает токен приглашения клиента из полного URL или относительного пути.
 * @param {string} value
 * @returns {string|null}
 */
const parseClientInviteToken = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  if (!text) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      const match = url.pathname.match(INVITE_PATH_RE);
      return match ? match[1] : null;
    }
  } catch (_error) {
    // fall through
  }

  const match = text.match(INVITE_PATH_RE);
  return match ? match[1] : null;
};

module.exports = {
  parseClientInviteToken,
  INVITE_PATH_RE,
};
