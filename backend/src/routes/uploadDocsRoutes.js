const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { ensureDocsDir, DOCS_DIR, ensureVoiceDir, VOICE_DIR } = require("../utils/uploadsPaths");
const {
  listUploadedDocs,
  uploadDoc,
  deleteUploadedDoc,
  listUploadedVoice,
  uploadVoice,
  deleteUploadedVoice,
  pickUniqueFilename,
} = require("../controllers/uploadDocsController");
const { normalizeMultipartFilename } = require("../utils/multipartFilename");
const { isAllowedUploadExtension, UPLOAD_REJECT_MESSAGE } = require("../utils/allowedUploadDocExtensions");
const { isAllowedVoiceExtension, UPLOAD_VOICE_REJECT_MESSAGE } = require("../utils/allowedUploadVoiceExtensions");
const { sanitizeBasename } = require("../utils/safeFilename");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDocsDir();
    cb(null, DOCS_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, pickUniqueFilename(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const utf8Name = normalizeMultipartFilename(file.originalname);
    const ext = path.extname(utf8Name).toLowerCase();
    const allowed = isAllowedUploadExtension(ext);
    if (!allowed) {
      const err = new Error(UPLOAD_REJECT_MESSAGE);
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

const pickUniqueFilenameByDir = (targetDir, originalName) => {
  const utf8Name = normalizeMultipartFilename(originalName);
  const safe = sanitizeBasename(utf8Name);
  if (!fs.existsSync(path.join(targetDir, safe))) {
    return safe;
  }
  const ext = path.extname(safe);
  const stem = path.basename(safe, ext) || "file";
  let i = 1;
  let candidate = `${stem}_${i}${ext}`;
  while (fs.existsSync(path.join(targetDir, candidate))) {
    i += 1;
    candidate = `${stem}_${i}${ext}`;
  }
  return candidate;
};

const voiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureVoiceDir();
    cb(null, VOICE_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, pickUniqueFilenameByDir(VOICE_DIR, file.originalname));
  },
});

const uploadVoiceMulter = multer({
  storage: voiceStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const utf8Name = normalizeMultipartFilename(file.originalname);
    const ext = path.extname(utf8Name).toLowerCase();
    const allowed = isAllowedVoiceExtension(ext);
    if (!allowed) {
      const err = new Error(UPLOAD_VOICE_REJECT_MESSAGE);
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

const router = express.Router();

router.get("/docs", listUploadedDocs);
router.delete("/docs", deleteUploadedDoc);
router.post("/docs", upload.single("file"), uploadDoc);
router.get("/voice", listUploadedVoice);
router.delete("/voice", deleteUploadedVoice);
router.post("/voice", uploadVoiceMulter.single("file"), uploadVoice);

module.exports = router;
