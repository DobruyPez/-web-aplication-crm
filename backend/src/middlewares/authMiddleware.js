const { parsePositiveInt } = require("../utils/validators");
const { verifyToken } = require("../utils/jwt");

const authMiddleware = (req, res, next) => {
  const authHeader = req.header("authorization");
  const bearer = authHeader && String(authHeader).startsWith("Bearer ") ? authHeader.slice(7) : null;

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
  const role = roleHeader ? String(roleHeader).trim().toUpperCase() : "ADMIN";
  const userId = userIdHeader ? parsePositiveInt(userIdHeader) : 1;

  req.auth = {
    role: role === "MANAGER" ? "MANAGER" : "ADMIN",
    userId: userId || 1,
  };

  next();
};

module.exports = authMiddleware;
