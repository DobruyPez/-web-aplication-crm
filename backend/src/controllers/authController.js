const prisma = require("../config/prisma");
const { comparePassword } = require("../utils/authPassword");
const { signToken } = require("../utils/jwt");
const sanitizeUser = require("../utils/sanitizeUser");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Укажите email и пароль." });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    if (!user || !comparePassword(String(password), user.password)) {
      return res.status(401).json({ message: "Неверный email или пароль." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ message: "Не авторизован." });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
    });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  me,
};
