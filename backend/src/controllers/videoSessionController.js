const path = require("path");
const fs = require("fs");
const videoSessionService = require("../services/videoSessionService");
const { VOICE_DIR, ensureVoiceDir } = require("../utils/uploadsPaths");
const { sanitizeBasename } = require("../utils/safeFilename");
const { normalizeMultipartFilename } = require("../utils/multipartFilename");
const {
  upsertFileEntry: upsertVoiceEntry,
} = require("../utils/voiceFilesIndex");

const VOICE_WEB_PATH_PREFIX = "/uploads/voice";

const createSession = async (req, res, next) => {
  try {
    const result = await videoSessionService.createSession(req.body, req.auth, req);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const result = await videoSessionService.getSession(req.params.id, req.auth);
    if (!result) {
      return res.status(404).json({ message: "Сессия не найдена." });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getPublicHint = async (req, res, next) => {
  try {
    const result = await videoSessionService.getPublicHint(req.params.id, req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getJoinMeta = async (req, res, next) => {
  try {
    const result = await videoSessionService.getJoinMeta(req.params.guestToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const joinSession = async (req, res, next) => {
  try {
    const peerId = req.body?.peerId || req.query?.peerId;
    const result = await videoSessionService.joinSession(
      req.params.guestToken,
      peerId,
      req.auth,
      req,
      { viaWs: false },
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const endSession = async (req, res, next) => {
  try {
    const result = await videoSessionService.endSession(req.params.id, req.auth);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const uploadRecording = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не получен." });
    }

    const storedName = path.basename(req.file.filename);
    const ext = path.extname(storedName).toLowerCase();
    if (ext !== ".webm") {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(400).json({ message: "Допускается только video/webm (.webm)." });
    }

    const recordingUrl = `${VOICE_WEB_PATH_PREFIX}/${storedName}`;
    const entry = {
      filename: storedName,
      filePath: recordingUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || "video/webm",
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: req.auth.userId,
      videoSessionId: req.params.id,
    };
    upsertVoiceEntry(entry);

    const session = await videoSessionService.saveRecording(req.params.id, recordingUrl, req.auth);
    res.status(201).json({ recordingUrl, session });
  } catch (error) {
    next(error);
  }
};

const pickSessionRecordingFilename = (sessionId, originalName) => {
  ensureVoiceDir();
  const utf8Name = normalizeMultipartFilename(originalName);
  const safe = sanitizeBasename(utf8Name);
  const ext = path.extname(safe).toLowerCase() === ".webm" ? ".webm" : ".webm";
  const stem = `video-${sessionId}-${Date.now()}`;
  let candidate = `${stem}${ext}`;
  let i = 1;
  while (fs.existsSync(path.join(VOICE_DIR, candidate))) {
    candidate = `${stem}_${i}${ext}`;
    i += 1;
  }
  return candidate;
};

module.exports = {
  createSession,
  getSession,
  getPublicHint,
  getJoinMeta,
  joinSession,
  endSession,
  uploadRecording,
  pickSessionRecordingFilename,
};
