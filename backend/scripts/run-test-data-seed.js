/**
 * npm run db:test-data — заливка под учёткой из DATABASE_URL (обычно app_admin).
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const backendRoot = path.join(__dirname, "..");
const repoRoot = path.join(backendRoot, "..");

// backend/.env, затем корневой .env (у вас DATABASE_URL в корне проекта)
require("dotenv").config({ path: path.join(backendRoot, ".env") });
require("dotenv").config({ path: path.join(repoRoot, ".env") });

const seedPath = path.join(repoRoot, "tests/seed_test_data.sql");

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_ADMIN ||
    process.env.POSTGRES_SEED_URL ||
    ""
  );
}

function main() {
  if (!fs.existsSync(seedPath)) {
    console.error("Не найден:", seedPath);
    process.exit(1);
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error("Задайте DATABASE_URL в backend/.env или в корневом .env");
    process.exit(1);
  }

  let who = "db";
  try {
    who = new URL(databaseUrl).username;
  } catch {
    /* ignore */
  }

  console.log(`Заливка tests/seed_test_data.sql (${who})…`);

  const rel = path.relative(backendRoot, seedPath).split(path.sep).join("/");
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(npx, ["prisma", "db", "execute", "--file", rel, "--schema", "prisma/schema.prisma"], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (r.status === 0) {
    console.log("Готово. Админ: user_1@test.crm.local / 1234");
  }

  process.exit(r.status ?? 1);
}

main();
