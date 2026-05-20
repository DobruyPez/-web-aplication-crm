const requireAdmin = (req, res, next) => {
  if (!req.auth || req.auth.role !== "ADMIN") {
    return res.status(403).json({ message: "Требуются права администратора." });
  }
  next();
};

module.exports = requireAdmin;
