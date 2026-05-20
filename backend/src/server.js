const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});
const fs = require("fs");
const http = require("http");
const https = require("https");
const prisma = require("./config/prisma");
const app = require("./app");
const { startTelegramPolling } = require("./services/telegramPollingService");

const PORT = process.env.PORT || 4000;
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED || "").toLowerCase() === "true";
const HTTPS_PORT = Number.parseInt(process.env.HTTPS_PORT || "4443", 10);
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || "";
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || "";
const HTTPS_CA_PATH = process.env.HTTPS_CA_PATH || "";
const HTTP_REDIRECT_TO_HTTPS = String(process.env.HTTP_REDIRECT_TO_HTTPS || "").toLowerCase() === "true";

/** Пути из .env считаются относительно каталога backend, а не process.cwd(). */
const backendRoot = path.join(__dirname, "..");
const resolveTlsPath = (filePath) => {
  if (!filePath) {
    return filePath;
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(backendRoot, filePath);
};

const readCertFile = (filePath) => (filePath ? fs.readFileSync(filePath) : undefined);

const createTlsOptions = () => {
  if (!HTTPS_KEY_PATH || !HTTPS_CERT_PATH) {
    throw new Error("HTTPS_KEY_PATH и HTTPS_CERT_PATH обязательны при HTTPS_ENABLED=true");
  }

  // Расширения .crt / .pem не важны: нужны PEM-тексты (BEGIN ... END). Сертификат — в HTTPS_CERT_PATH, ключ — в HTTPS_KEY_PATH.

  return {
    key: readCertFile(resolveTlsPath(HTTPS_KEY_PATH)),
    cert: readCertFile(resolveTlsPath(HTTPS_CERT_PATH)),
    ...(HTTPS_CA_PATH ? { ca: readCertFile(resolveTlsPath(HTTPS_CA_PATH)) } : {}),
  };
};

const assertTlsFilesExist = () => {
  if (!HTTPS_KEY_PATH || !HTTPS_CERT_PATH) {
    return;
  }
  const keyPath = resolveTlsPath(HTTPS_KEY_PATH);
  const certPath = resolveTlsPath(HTTPS_CERT_PATH);
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error("Не найдены файлы TLS для HTTPS:");
    console.error(`  ключ:    ${keyPath}`);
    console.error(`  сертиф.: ${certPath}`);
    console.error("");
    console.error('Сгенерируйте доверенные для браузера сертификаты mkcert и включите их в .env:');
    console.error("  npm run certs:mkcert");
    console.error("Один раз на компьютере (локальный ЦС):");
    console.error("  mkcert -install");
    console.error("");
    process.exit(1);
  }
};

const createRedirectServer = () =>
  http.createServer((req, res) => {
    const hostHeader = req.headers.host || "";
    const hostWithoutPort = hostHeader.split(":")[0];
    const targetHost = HTTPS_PORT === 443 ? hostWithoutPort : `${hostWithoutPort}:${HTTPS_PORT}`;
    res.writeHead(301, { Location: `https://${targetHost}${req.url}` });
    res.end();
  });

const printListenHints = () => {
  const httpApi = `http://localhost:${PORT}/api`;
  console.log("");
  console.log("=== CRM backend ==================================================");
  console.log(`  Рабочий адрес API (HTTP): ${httpApi}`);
  console.log(`  Проверка:                http://localhost:${PORT}/api/health`);
  if (!HTTPS_ENABLED) {
    console.log("");
    console.log(`  HTTPS сейчас ВЫКЛЮЧЕН (HTTPS_ENABLED=false).`);
    console.log(`  Порт ${HTTPS_PORT} не слушается → в браузере https://localhost:${HTTPS_PORT} будет ERR_CONNECTION_REFUSED.`);
    console.log(`  Открывайте сервис по HTTP (ссылки выше) или включите HTTPS с доверенным сертификатом (например mkcert).`);
    console.log(`  Надпись Chrome «Не защищено» для http://localhost — нормально для локальной разработки без TLS.`);
  } else {
    console.log(`  HTTPS:                   https://localhost:${HTTPS_PORT}/api`);
  }
  console.log("================================================================");
  console.log("");
};

const start = async () => {
  try {
    if (HTTPS_ENABLED) {
      assertTlsFilesExist();
      const tlsOptions = createTlsOptions();
      https.createServer(tlsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`CRM API running on https://localhost:${HTTPS_PORT}`);
      });

      if (HTTP_REDIRECT_TO_HTTPS) {
        createRedirectServer().listen(PORT, () => {
          console.log(`HTTP redirect server running on http://localhost:${PORT} -> https://localhost:${HTTPS_PORT}`);
          printListenHints();
        });
      } else {
        http.createServer(app).listen(PORT, () => {
          console.log(`CRM API running on http://localhost:${PORT} (HTTPS also enabled)`);
          printListenHints();
        });
      }
    } else {
      http.createServer(app).listen(PORT, () => {
        console.log(`CRM API running on http://localhost:${PORT}`);
        printListenHints();
      });
    }

    try {
      await prisma.$connect();
      console.log("PostgreSQL connected (Prisma).");
    } catch (dbErr) {
      console.error("PostgreSQL unavailable:", dbErr.message);
      console.error("HTTP(S) is up; routes that need the DB will fail until PostgreSQL accepts connections.");
    }

    await startTelegramPolling();
  } catch (error) {
    console.error("Server startup error:", error.message);
    process.exit(1);
  }
};

start();
