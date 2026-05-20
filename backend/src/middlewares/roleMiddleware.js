const { parsePositiveInt } = require("../utils/validators");

const roleMiddleware = (req, _res, next) => {
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

module.exports = roleMiddleware;
