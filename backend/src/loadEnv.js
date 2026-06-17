/**
 * Единая загрузка .env для backend (локально и Docker с mount backend/.env → /app/.env).
 * override: false — не затирает переменные, уже заданные Docker Compose.
 */
const path = require("path");
const fs = require("fs");

const backendRoot = path.join(__dirname, "..");
const repoRoot = path.join(backendRoot, "..");

const candidates = [
  path.join(backendRoot, ".env"),
  path.join(repoRoot, ".env"),
];

function loadEnv() {
  const dotenv = require("dotenv");
  let loaded = 0;
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    const result = dotenv.config({ path: envPath, override: false });
    if (result?.parsed) {
      loaded += Object.keys(result.parsed).length;
    }
  }
  return loaded;
}

module.exports = { loadEnv, backendRoot, repoRoot };
