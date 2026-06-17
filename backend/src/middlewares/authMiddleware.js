const { parsePositiveInt } = require("../utils/validators");
const { verifyToken } = require("../utils/jwt");

/** Полный путь запроса (Express на вложенных роутерах может давать req.path без /api). */
const requestPath = (req) => {
  const raw = req.originalUrl || req.url || req.path || "";
  return String(raw).split("?")[0];
};

const isPublicApiPath = (req, method) => {
  const p = requestPath(req);
  if (method === "POST" && p === "/api/auth/login") {
    return true;
  }
  if (method === "POST" && p === "/api/debug-log") {
    return true;
  }
  if (p.startsWith("/api/client-invite/")) {
    return true;
  }
  if (/^\/api\/video-sessions\/join\/[^/]+$/.test(p) && (method === "GET" || method === "POST")) {
    return true;
  }
  if (/^\/api\/video-sessions\/[^/]+\/public-hint$/.test(p) && method === "GET") {
    return true;
  }
  return false;
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.header("authorization");
  const bearer = authHeader && String(authHeader).startsWith("Bearer ") ? authHeader.slice(7) : null;
  const publicPath = isPublicApiPath(req, req.method);

  if (bearer) {
    try {
      const payload = verifyToken(bearer);
      req.auth = {
        role: payload.role === "MANAGER" ? "MANAGER" : "ADMIN",
        userId: Number(payload.userId),
      };
      return next();
    } catch (_error) {
      return res.status(401).json({ message: "Неверный или просроченный токен." });
    }
  }

  const roleHeader = req.header("x-user-role");
  const userIdHeader = req.header("x-user-id");

  if (publicPath && !bearer && !roleHeader && !userIdHeader) {
    req.auth = null;
    return next();
  }

  if (roleHeader || userIdHeader) {
    const role = roleHeader ? String(roleHeader).trim().toUpperCase() : "ADMIN";
    const userId = userIdHeader ? parsePositiveInt(userIdHeader) : 1;
    req.auth = {
      role: role === "MANAGER" ? "MANAGER" : "ADMIN",
      userId: userId || 1,
    };
    return next();
  }

  req.auth = {
    role: "ADMIN",
    userId: 1,
  };

  next();
};

module.exports = authMiddleware;
