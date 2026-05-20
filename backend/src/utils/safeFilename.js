const path = require("path");

/**
 * Только базовое имя файла, без пути.
 * Кириллица и другие буквы сохраняются; убираются только недопустимые для файловых систем символы и попытки path traversal.
 */
const sanitizeBasename = (name) => {
  let base = path.basename(String(name || "file"))
    .replace(/["\0]/g, "")
    .normalize("NFC");

  // WindowsReservedNames не используем как имя без расширения — маловероятно для загрузок
  base = base.replace(/[/\\:*?"<>|]/g, "_").trim();
  base = base.replace(/^\.+/, "_");

  return base || "file";
};

module.exports = { sanitizeBasename };
