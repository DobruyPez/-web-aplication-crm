/**
 * Белый список: PDF + документы Microsoft Word (типичные расширения; включая .docs по запросу).
 */
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docs",
  ".doc",
  ".docx",
  ".docm",
  ".dot",
  ".dotx",
  ".dotm",
  ".rtf",
  ".wps",
  ".wbk",
]);

const isAllowedUploadExtension = (ext) => ALLOWED_EXTENSIONS.has(String(ext || "").toLowerCase());

const UPLOAD_REJECT_MESSAGE = `Допускаются только PDF и документы Word (${Array.from(ALLOWED_EXTENSIONS).sort().join(", ")}).`;

module.exports = {
  ALLOWED_EXTENSIONS,
  isAllowedUploadExtension,
  UPLOAD_REJECT_MESSAGE,
};
