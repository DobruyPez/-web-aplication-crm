/**
 * Скачивает официальный бинарник mkcert в каталог <repo>/tools/
 * (если winget/GitHub в браузере не работают).
 *
 *   npm run mkcert:download --prefix backend
 *
 * Затем один раз на ПК:  tools\\mkcert.exe -install   (от администратора при необходимости)
 * И генерация PEM:       npm run certs:mkcert --prefix backend
 */
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const VERSION = "v1.4.4";
const BASE = `https://github.com/FiloSottile/mkcert/releases/download/${VERSION}`;

const projectRoot = path.resolve(__dirname, "..", "..");
const toolsDir = path.join(projectRoot, "tools");

function assetForPlatform() {
  const platform = process.platform;
  const arch = os.arch();
  if (platform === "win32") {
    const name = arch === "arm64" ? `mkcert-${VERSION}-windows-arm64.exe` : `mkcert-${VERSION}-windows-amd64.exe`;
    return { name, dest: path.join(toolsDir, "mkcert.exe") };
  }
  if (platform === "darwin") {
    const name = arch === "arm64" ? `mkcert-${VERSION}-darwin-arm64` : `mkcert-${VERSION}-darwin-amd64`;
    return { name, dest: path.join(toolsDir, "mkcert") };
  }
  if (platform === "linux") {
    let name = `mkcert-${VERSION}-linux-amd64`;
    if (arch === "arm64") name = `mkcert-${VERSION}-linux-arm64`;
    else if (arch === "arm") name = `mkcert-${VERSION}-linux-arm`;
    return { name, dest: path.join(toolsDir, "mkcert") };
  }
  throw new Error(`Платформа не поддерживается скриптом: ${platform} ${arch}`);
}

function get(url, redirectsLeft = 8) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) {
      reject(new Error("Слишком много перенаправлений"));
      return;
    }
    https
      .get(
        url,
        {
          headers: { "User-Agent": "CourseProject-mkcert-download/1.0" },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const next = new URL(res.headers.location, url).href;
            res.resume();
            get(next, redirectsLeft - 1).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            return;
          }
          resolve(res);
        },
      )
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(toolsDir, { recursive: true });
  const { name, dest } = assetForPlatform();
  const url = `${BASE}/${name}`;

  console.log("Загрузка:", url);
  const res = await get(url);
  const tmp = `${dest}.download`;

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    res.pipe(out);
    out.on("finish", () => out.close(resolve));
    out.on("error", reject);
  });

  try {
    fs.rmSync(dest, { force: true });
  } catch (_e) {
    /* noop */
  }
  fs.renameSync(tmp, dest);

  if (process.platform !== "win32") {
    try {
      fs.chmodSync(dest, 0o755);
    } catch (_e) {
      /* noop */
    }
  }

  console.log("");
  console.log("Сохранено:", dest);
  console.log("");
  console.log("Дальше:");
  console.log("  1) Установите локальный ЦС (один раз, желательно терминал от администратора):");
  if (process.platform === "win32") {
    console.log(`       PowerShell:  & "${dest}" -install`);
    console.log(`       cmd.exe:     "${dest}" -install`);
  } else {
    console.log(`       "${dest}" -install`);
  }
  console.log("  2) Создайте PEM для проекта:");
  console.log("       npm run certs:mkcert --prefix backend");
}

main().catch((err) => {
  console.error(err.message || err);
  console.error(`
Если загрузка блокируется сетью/антивирусом, скачайте файл вручную со страницы релиза и положите как:
  ${path.join(toolsDir, process.platform === "win32" ? "mkcert.exe" : "mkcert")}
https://github.com/FiloSottile/mkcert/releases/tag/${VERSION}
`);
  process.exit(1);
});
