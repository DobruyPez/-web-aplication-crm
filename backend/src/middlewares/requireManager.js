const requireManager = (req, res, next) => {
  if (!req.auth || req.auth.role !== "MANAGER") {
    return res.status(403).json({ message: "Доступно только менеджерам." });
  }
  next();
};

module.exports = requireManager;
