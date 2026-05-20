/**
 * Доверенный HTTPS для localhost («замочек» в браузере): сертификаты через mkcert.
 *
 * Один раз на компьютере (локальный ЦС в хранилище доверия):
 *   mkcert -install
 *   Если mkcert нет в PATH: сначала npm run mkcert:download — появится tools/mkcert.exe, затем:
 *     tools\mkcert.exe -install   (Windows, при необходимости из терминала администратора)
 *
 * Запуск генерации ключей для этого проекта:
 *   npm run certs:mkcert --prefix backend
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const certsDir = path.join(projectRoot, "certs");
const keyFile = "mkcert-localhost-key.pem";
const certFile = "mkcert-localhost.pem";

const keyPath = path.join(certsDir, keyFile);
const certPath = path.join(certsDir, certFile);

function resolveMkcertExecutable() {
  const envExe = process.env.MKCERT_EXE && String(process.env.MKCERT_EXE).trim();
  if (envExe && fs.existsSync(envExe)) {
    return { exe: envExe, shell: false };
  }

  const toolsWin = path.join(projectRoot, "tools", "mkcert.exe");
  const toolsUnix = path.join(projectRoot, "tools", "mkcert");
  if (process.platform === "win32" && fs.existsSync(toolsWin)) {
    return { exe: toolsWin, shell: false };
  }
  if (process.platform !== "win32" && fs.existsSync(toolsUnix)) {
    return { exe: toolsUnix, shell: false };
  }

  return { exe: "mkcert", shell: process.platform === "win32" };
}

function runMkcert() {
  const args = ["-key-file", keyPath, "-cert-file", certPath, "localhost", "127.0.0.1", "::1"];
  const { exe, shell } = resolveMkcertExecutable();

  const result = spawnSync(exe, args, {
    encoding: "utf8",
    shell,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status === 0) {
    return { ok: true };
  }

  const msg = (result.stderr || result.stdout || "").trim() || result.error?.message || `exit ${result.status}`;
  return { ok: false, message: msg };
}

function main() {
  fs.mkdirSync(certsDir, { recursive: true });

  const result = runMkcert();
  if (!result.ok) {
    console.error(result.message || "Ошибка mkcert");
    console.error(`
Не удалось создать сертификаты.

1) Скачайте mkcert в проект (если winget/GitHub не работают):
     npm run mkcert:download --prefix backend

2) Один раз установите локальный ЦС в систему (часто нужен терминал администратора):
     PowerShell:  & ".\\tools\\mkcert.exe" -install   (из корня репозитория; нужен символ &)
     cmd.exe:     tools\\mkcert.exe -install
     Или:         mkcert -install   (если mkcert уже в PATH)

3) Повторите:
     npm run certs:mkcert --prefix backend

Подробнее: https://github.com/FiloSottile/mkcert
`);
    process.exit(1);
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error("mkcert завершился без ошибок, но файлы не найдены:", keyPath, certPath);
    process.exit(1);
  }

  console.log("Готово (браузер доверяет после mkcert -install):");
  console.log(`  ${keyPath}`);
  console.log(`  ${certPath}`);
  console.log("");
  console.log("В backend/.env для HTTPS на порту 4443:");
  console.log(`  HTTPS_ENABLED=true`);
  console.log(`  HTTPS_PORT=4443`);
  console.log(`  HTTPS_KEY_PATH=../certs/${keyFile}`);
  console.log(`  HTTPS_CERT_PATH=../certs/${certFile}`);
  console.log("");
  console.log("Фронтенд (.env): VITE_API_BASE_URL=https://localhost:4443/api");
}

main();
