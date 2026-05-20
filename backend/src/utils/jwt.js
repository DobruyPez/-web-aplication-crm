const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const normalizeRoleForToken = (role) =>
  String(role).toLowerCase() === "admin" ? "ADMIN" : "MANAGER";

const signToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      role: normalizeRoleForToken(user.role),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

module.exports = {
  JWT_SECRET,
  signToken,
  verifyToken,
  normalizeRoleForToken,
};
