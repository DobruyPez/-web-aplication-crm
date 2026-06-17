const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const requireManager = require("../middlewares/requireManager");
const optionalAuth = require("../middlewares/optionalAuth");
const {
  createSession,
  getSession,
  getPublicHint,
  getJoinMeta,
  joinSession,
  endSession,
  uploadRecording,
  pickSessionRecordingFilename,
} = require("../controllers/videoSessionController");
const { ensureVoiceDir, VOICE_DIR } = require("../utils/uploadsPaths");
const { normalizeMultipartFilename } = require("../utils/multipartFilename");

const sessionRecordingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureVoiceDir();
    cb(null, VOICE_DIR);
  },
  filename: (req, file, cb) => {
    const name = pickSessionRecordingFilename(req.params.id, file.originalname);
    cb(null, name);
  },
});

const uploadSessionRecording = multer({
  storage: sessionRecordingStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const utf8Name = normalizeMultipartFilename(file.originalname);
    const ext = path.extname(utf8Name).toLowerCase();
    if (ext !== ".webm") {
      const err = new Error("Допускается только .webm");
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

const router = express.Router();

router.get("/join/:guestToken", getJoinMeta);
router.post("/join/:guestToken", optionalAuth, joinSession);

router.post("/", requireManager, createSession);
router.get("/:id/public-hint", getPublicHint);
router.get("/:id", getSession);
router.post("/:id/end", requireManager, endSession);
router.post("/:id/recording", requireManager, uploadSessionRecording.single("file"), uploadRecording);

module.exports = router;
