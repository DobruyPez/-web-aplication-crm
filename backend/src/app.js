const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const routes = require("./routes");
const authMiddleware = require("./middlewares/authMiddleware");
const notFoundMiddleware = require("./middlewares/notFoundMiddleware");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();
const enforceHttps = String(process.env.ENFORCE_HTTPS || "").toLowerCase() === "true";
const trustProxy = String(process.env.TRUST_PROXY || "").toLowerCase() === "true";

if (trustProxy) {
  app.set("trust proxy", 1);
}

const uploadsRoot = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsRoot));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors());
app.use(express.json());

if (enforceHttps) {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      return next();
    }
    const host = req.headers.host;
    if (!host) {
      return next();
    }
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

app.use(authMiddleware);

const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
const spaIndexPath = path.join(frontendDist, "index.html");
const spaReady = fs.existsSync(spaIndexPath);

const apiRootJson = (_req, res) => {
  res.json({
    name: "CRM Course API",
    docs: {
      protocol:
        String(process.env.HTTPS_ENABLED || "").toLowerCase() === "true"
          ? "https (tls enabled)"
          : "http (tls disabled)",
      roleHeader: "x-user-role: ADMIN | MANAGER",
      userHeader: "x-user-id: <number>",
      endpoints: [
        "/api/auth/login",
        "/api/auth/me",
        "/api/telegram/webhook",
        "/api/users",
        "/api/clients",
        "/api/deals",
        "/api/tasks",
        "/api/calls",
        "/api/documents",
        "/api/dashboard/overview",
        "/api/uploads/docs",
        "/api/uploads/voice",
        "DELETE /api/uploads/docs?filename=<name>",
        "DELETE /api/uploads/voice?filename=<name>",
      ],
    },
  });
};

app.use("/api", routes);

if (spaReady) {
  const cacheHeadersForStatic = (res, absolutePath) => {
    const base = absolutePath.replace(/\\/g, "/");
    if (base.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      return;
    }
    if (base.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  };

  app.use(
    express.static(frontendDist, {
      setHeaders: cacheHeadersForStatic,
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    return res.sendFile(spaIndexPath, (err) => {
      if (err) {
        next(err);
      }
    });
  });
} else {
  app.get("/", apiRootJson);
}

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
