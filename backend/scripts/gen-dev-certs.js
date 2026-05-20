/**
 * Writes self-signed localhost TLS files to <repo>/certs/ for local HTTPS dev only.
 * Run: npm run certs --prefix backend
 *
 * Браузеры не доверяют этому сертификату → будет предупреждение ERR_CERT_AUTHORITY_INVALID.
 * Для «замочка» используйте: npm run certs:mkcert (mkcert CLI + один раз mkcert -install).
 */
const fs = require("fs");
const path = require("path");
const selfsigned = require("selfsigned");

const projectRoot = path.resolve(__dirname, "..", "..");
const certsDir = path.join(projectRoot, "certs");

async function main() {
  fs.mkdirSync(certsDir, { recursive: true });

  const attrs = [{ name: "commonName", value: "localhost" }];
  const notBefore = new Date();
  const notAfter = new Date(notBefore);
  notAfter.setDate(notAfter.getDate() + 825);

  const pem = await selfsigned.generate(attrs, {
    algorithm: "sha256",
    keySize: 2048,
    notBeforeDate: notBefore,
    notAfterDate: notAfter,
  });

  const keyPath = path.join(certsDir, "localhost.key");
  const crtPath = path.join(certsDir, "localhost.crt");

  fs.writeFileSync(keyPath, pem.private);
  fs.writeFileSync(crtPath, pem.cert);

  console.log(`Wrote:\n  ${keyPath}\n  ${crtPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
