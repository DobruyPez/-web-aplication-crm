import { buildClientInviteUrl } from "./appUrl";

const INVITE_PATH_RE = /\/client-invite\/([a-zA-Z0-9_-]+)/i;

/** Токен из полного URL или пути /client-invite/:token */
export function parseClientInviteToken(value) {
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
  } catch {
    /* fall through */
  }

  const match = text.match(INVITE_PATH_RE);
  return match ? match[1] : null;
}

export function resolveClientInviteAbsoluteUrl(link) {
  if (!link) {
    return "";
  }
  const token = parseClientInviteToken(link);
  if (token) {
    return buildClientInviteUrl(token);
  }
  return link;
}
