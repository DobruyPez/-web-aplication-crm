const errorMiddleware = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  if (!err.statusCode && typeof err.message === "string" && err.message.includes("Допускаются только")) {
    statusCode = 400;
  }
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
};

module.exports = errorMiddleware;
