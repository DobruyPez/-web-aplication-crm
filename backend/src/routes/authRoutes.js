const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

const registrationDisabled = (_req, res) =>
  res.status(403).json({
    message: "Регистрация отключена. Новых менеджеров создаёт только администратор в разделе пользователей.",
  });

router.post("/register", registrationDisabled);
router.post("/verify-register", registrationDisabled);
router.post("/login", authController.login);
router.get("/me", authController.me);

module.exports = router;
