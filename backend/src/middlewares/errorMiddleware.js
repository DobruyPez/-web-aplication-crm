const { formatPrismaError } = require("../utils/prismaErrors");

const errorMiddleware = (err, _req, res, _next) => {
  const prismaMessage = formatPrismaError(err);
  let statusCode = err.statusCode || 500;
  if (!err.statusCode && typeof err.message === "string" && err.message.includes("Допускаются только")) {
    statusCode = 400;
  }
  if (prismaMessage && !err.statusCode) {
    statusCode = 400;
  }
  res.status(statusCode).json({
    message: prismaMessage || err.message || "Internal server error",
  });
};

module.exports = errorMiddleware;
