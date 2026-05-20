/**
 * Multer/Busboy нередко передаёт `originalname` как байты UTF-8, ошибочно прочитанные как latin1
 * (получается «Ð›Ð¸ÑÑ‚...» вместо «Лист...»).
 * Перекодирование latin1 → utf8 восстанавливает нормальное UTF-8 имя.
 *
 * Если в строке уже есть кириллица в правильных кодпоинтах (U+0400+) — видимо, кодировка уже верная.
 * Если после перекодирования появился U+FFFD — оставляем исходную строку (например «Übung»).
 */
function normalizeMultipartFilename(name) {
  if (name === undefined || name === null) {
    return "";
  }
  const str = String(name).normalize("NFC");
  if (!str) {
    return str;
  }

  if (/[\u0400-\u04FF\u0500-\u052F]/.test(str)) {
    return str;
  }

  let decoded;
  try {
    decoded = Buffer.from(str, "latin1").toString("utf8").normalize("NFC");
  } catch {
    return str;
  }

  if (decoded.includes("\uFFFD")) {
    return str;
  }

  if (/[\u0400-\u04FF\u0500-\u052F]/.test(decoded)) {
    return decoded;
  }

  return decoded;
}

module.exports = { normalizeMultipartFilename };
