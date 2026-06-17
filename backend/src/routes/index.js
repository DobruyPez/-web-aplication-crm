const express = require("express");
const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const resources = require("../config/resources");
const BaseRepository = require("../repositories/baseRepository");
const BaseService = require("../services/baseService");
const UserService = require("../services/userService");
const CallsService = require("../services/callsService");
const DealService = require("../services/dealService");
const TaskService = require("../services/taskService");
const BaseController = require("../controllers/baseController");
const createResourceRouter = require("./resourceRouterFactory");
const authRoutes = require("./authRoutes");
const telegramRoutes = require("./telegramRoutes");
const requireAdmin = require("../middlewares/requireAdmin");
const uploadDocsRoutes = require("./uploadDocsRoutes");
const videoSessionRoutes = require("./videoSessionRoutes");
const clientInviteRoutes = require("./clientInviteRoutes");
const DocumentService = require("../services/documentService");
const ClientService = require("../services/clientService");
const { dashboardOverview } = require("../controllers/dashboardController");
const { createInviteLink } = require("../controllers/clientInviteController");

const router = express.Router();

router.get("/", (_req, res) => {
  const httpsOn = String(process.env.HTTPS_ENABLED || "").toLowerCase() === "true";
  const port = Number.parseInt(process.env.PORT || "4000", 10);
  const httpsPort = Number.parseInt(process.env.HTTPS_PORT || "4443", 10);
  res.json({
    name: "CRM Course API",
    health: "/api/health",
    httpBase: `http://localhost:${port}/api`,
    ...(httpsOn ? { httpsBase: `https://localhost:${httpsPort}/api` } : {}),
    hint: httpsOn
      ? undefined
      : `HTTPS выключен: пользуйтесь http://localhost:${port}/api. Адрес https://localhost:${httpsPort} не обслуживается и даёт ERR_CONNECTION_REFUSED.`,
    auth: {
      login: "POST /api/auth/login",
      me: "GET /api/auth/me",
      note: "Регистрация отключена; POST /auth/register и /verify-register возвращают 403.",
    },
  });
});

router.use("/auth", authRoutes);
router.use("/telegram", telegramRoutes);
router.use("/uploads", uploadDocsRoutes);
router.use("/video-sessions", videoSessionRoutes);
router.use("/client-invite", clientInviteRoutes);
router.post("/clients/:id/invite-link", createInviteLink);
router.get("/dashboard/overview", dashboardOverview);

for (const resourceConfig of resources) {
  let ServiceClass = BaseService;
  if (resourceConfig.key === "users") {
    ServiceClass = UserService;
  }
  if (resourceConfig.key === "calls") {
    ServiceClass = CallsService;
  }
  if (resourceConfig.key === "deals") {
    ServiceClass = DealService;
  }
  if (resourceConfig.key === "tasks") {
    ServiceClass = TaskService;
  }
  if (resourceConfig.key === "documents") {
    ServiceClass = DocumentService;
  }
  if (resourceConfig.key === "clients") {
    ServiceClass = ClientService;
  }

  const repository = new BaseRepository(prisma, resourceConfig.modelName);
  const service = new ServiceClass(repository, resourceConfig);
  const controller = new BaseController(service, resourceConfig);

  const extra = resourceConfig.key === "users" ? [requireAdmin] : [];
  router.use(`/${resourceConfig.key}`, ...extra, createResourceRouter(controller));
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/debug-log", (req, res) => {
  try {
    const logDir = path.join(__dirname, "..", "..", "uploads", "debug");
    fs.mkdirSync(logDir, { recursive: true });
    const body = req.body || {};
    if (body.source === "video-record-batch" && Array.isArray(body.entries)) {
      const batchPath = path.join(
        logDir,
        `video-record-${body.sessionId || Date.now()}.json`,
      );
      fs.writeFileSync(batchPath, JSON.stringify(body.entries, null, 2), "utf8");
    }
    const logPath = path.join(logDir, "video-record.log");
    const line = `${JSON.stringify({ ...body, timestamp: Date.now() })}\n`;
    fs.appendFileSync(logPath, line, "utf8");
    res.status(204).end();
  } catch (err) {
    console.error("[debug-log] write failed:", err.message, "cwd=", process.cwd());
    res.status(500).json({ message: "debug log write failed" });
  }
});

module.exports = router;
