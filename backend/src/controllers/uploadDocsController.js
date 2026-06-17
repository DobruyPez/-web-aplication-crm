const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const { parsePositiveInt } = require("../utils/validators");
const { ensureDocsDir, DOCS_DIR, ensureVoiceDir, VOICE_DIR } = require("../utils/uploadsPaths");
const { upsertFileEntry, readIndex, removeFileEntry } = require("../utils/documentFilesIndex");
const {
  upsertFileEntry: upsertVoiceEntry,
  readIndex: readVoiceIndex,
  removeFileEntry: removeVoiceEntry,
} = require("../utils/voiceFilesIndex");
const { sanitizeBasename } = require("../utils/safeFilename");
const { normalizeMultipartFilename } = require("../utils/multipartFilename");
const { isAllowedUploadExtension, UPLOAD_REJECT_MESSAGE } = require("../utils/allowedUploadDocExtensions");
const { isAllowedVoiceExtension, UPLOAD_VOICE_REJECT_MESSAGE } = require("../utils/allowedUploadVoiceExtensions");

const WEB_PATH_PREFIX = "/uploads/docs";
const VOICE_WEB_PATH_PREFIX = "/uploads/voice";

const pickUniqueFilename = (originalName) => {
  ensureDocsDir();
  const utf8Name = normalizeMultipartFilename(originalName);
  const safe = sanitizeBasename(utf8Name);
  if (!fs.existsSync(path.join(DOCS_DIR, safe))) {
    return safe;
  }
  const ext = path.extname(safe);
  const stem = path.basename(safe, ext) || "file";
  let i = 1;
  let candidate = `${stem}_${i}${ext}`;
  while (fs.existsSync(path.join(DOCS_DIR, candidate))) {
    i += 1;
    candidate = `${stem}_${i}${ext}`;
  }
  return candidate;
};

const ensureClientAccess = async (clientId, auth) => {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    const err = new Error("Клиент не найден.");
    err.statusCode = 404;
    throw err;
  }
  if (auth.role === "ADMIN") {
    return client;
  }
  if (client.managerId !== auth.userId) {
    const err = new Error("Нет доступа к этому клиенту.");
    err.statusCode = 403;
    throw err;
  }
  return client;
};

const listUploadedDocs = async (req, res, next) => {
  try {
    ensureDocsDir();
    const index = readIndex();
    const namesOnDisk = fs
      .readdirSync(DOCS_DIR)
      .filter((name) => name !== ".files-index.json" && !name.startsWith("."));

    const byName = new Map(index.files.map((f) => [f.filename, f]));

    let merged = namesOnDisk.map((filename) => {
      const abs = path.join(DOCS_DIR, filename);
      const stat = fs.statSync(abs);
      const prev = byName.get(filename);
      return {
        filename,
        filePath: `${WEB_PATH_PREFIX}/${filename}`,
        fileSize: stat.isFile() ? stat.size : prev?.fileSize ?? 0,
        mimeType: prev?.mimeType ?? "application/octet-stream",
        uploadedAt: prev?.uploadedAt ?? stat.mtime.toISOString(),
        clientId: prev?.clientId ?? null,
        uploadedByUserId: prev?.uploadedByUserId ?? null,
      };
    });

    if (req.auth?.role === "MANAGER" && req.auth?.userId) {
      const managerClients = await prisma.client.findMany({
        where: { managerId: req.auth.userId },
        select: { id: true },
      });
      const allowedClientIds = new Set(managerClients.map((c) => c.id));

      const linkedDocs = await prisma.document.findMany({
        where: { client: { managerId: req.auth.userId } },
        select: { filename: true },
      });
      const linkedFilenames = new Set(linkedDocs.map((d) => d.filename));

      merged = merged.filter((file) => {
        if (file.clientId != null && allowedClientIds.has(file.clientId)) {
          return true;
        }
        if (linkedFilenames.has(file.filename)) {
          return true;
        }
        if (file.clientId == null && file.uploadedByUserId === req.auth.userId) {
          return true;
        }
        return false;
      });
    }

    merged.sort((a, b) => String(a.filename).localeCompare(String(b.filename)));

    res.json(merged);
  } catch (error) {
    next(error);
  }
};

const uploadDoc = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не получен." });
    }

    const storedName = path.basename(req.file.filename);
    const ext = path.extname(storedName).toLowerCase();
    const extOk = isAllowedUploadExtension(ext);
    if (!extOk) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_unlinkErr) {
        /* ignore */
      }
      return res.status(400).json({
        message: UPLOAD_REJECT_MESSAGE,
      });
    }

    let clientId = null;
    const rawClientId = req.body.clientId;
    if (rawClientId !== undefined && rawClientId !== null && String(rawClientId).trim() !== "") {
      const parsed = parsePositiveInt(rawClientId);
      if (!parsed) {
        return res.status(400).json({ message: "Некорректный clientId." });
      }
      await ensureClientAccess(parsed, req.auth);
      clientId = parsed;
    }

    const filename = storedName;
    const filePath = `${WEB_PATH_PREFIX}/${filename}`;

    const entry = {
      filename,
      filePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      clientId,
      uploadedByUserId: req.auth.userId,
    };

    upsertFileEntry(entry);

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
};

const deleteUploadedDoc = async (req, res, next) => {
  try {
    const raw = req.query.filename;
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      return res.status(400).json({ message: "Укажите параметр filename." });
    }

    let decoded;
    try {
      decoded = decodeURIComponent(String(raw));
    } catch (_error) {
      return res.status(400).json({ message: "Некорректное имя файла." });
    }

    const filename = sanitizeBasename(decoded);
    if (!filename || filename === "file") {
      return res.status(400).json({ message: "Некорректное имя файла." });
    }

    const abs = path.resolve(path.join(DOCS_DIR, filename));
    const root = path.resolve(DOCS_DIR);
    if (!abs.startsWith(root)) {
      return res.status(400).json({ message: "Некорректное имя файла." });
    }

    if (filename === ".files-index.json" || filename.startsWith(".")) {
      return res.status(400).json({ message: "Нельзя удалить служебный файл." });
    }

    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      fs.unlinkSync(abs);
    }

    removeFileEntry(filename);

    res.json({ message: "Файл удалён.", filename });
  } catch (error) {
    next(error);
  }
};

const forbidManagerVoice = (req, res) => {
  if (req.auth?.role === "MANAGER") {
    res.status(403).json({ message: "Менеджеру недоступно управление голосовыми файлами." });
    return true;
  }
  return false;
};

const listUploadedVoice = async (req, res, next) => {
  try {
    if (forbidManagerVoice(req, res)) {
      return;
    }
    ensureVoiceDir();
    const index = readVoiceIndex();
    const namesOnDisk = fs
      .readdirSync(VOICE_DIR)
      .filter((name) => name !== ".files-index.json" && !name.startsWith("."));

    const byName = new Map(index.files.map((f) => [f.filename, f]));

    const merged = namesOnDisk.map((filename) => {
      const abs = path.join(VOICE_DIR, filename);
      const stat = fs.statSync(abs);
      const prev = byName.get(filename);
      return {
        filename,
        filePath: `${VOICE_WEB_PATH_PREFIX}/${filename}`,
        fileSize: stat.isFile() ? stat.size : prev?.fileSize ?? 0,
        mimeType: prev?.mimeType ?? "audio/mpeg",
        uploadedAt: prev?.uploadedAt ?? stat.mtime.toISOString(),
        uploadedByUserId: prev?.uploadedByUserId ?? null,
      };
    });

    merged.sort((a, b) => String(a.filename).localeCompare(String(b.filename)));
    res.json(merged);
  } catch (error) {
    next(error);
  }
};

const uploadVoice = async (req, res, next) => {
  try {
    if (forbidManagerVoice(req, res)) {
      return;
    }
    if (!req.file) {
      return res.status(400).json({ message: "Файл не получен." });
    }

    const storedName = path.basename(req.file.filename);
    const ext = path.extname(storedName).toLowerCase();
    const extOk = isAllowedVoiceExtension(ext);
    if (!extOk) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_unlinkErr) {
        /* ignore */
      }
      return res.status(400).json({ message: UPLOAD_VOICE_REJECT_MESSAGE });
    }

    const entry = {
      filename: storedName,
      filePath: `${VOICE_WEB_PATH_PREFIX}/${storedName}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || "audio/mpeg",
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: req.auth.userId,
    };
    upsertVoiceEntry(entry);
    return res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
};

const deleteUploadedVoice = async (req, res, next) => {
  try {
    if (forbidManagerVoice(req, res)) {
      return;
    }
    const raw = req.query.filename;
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      return res.status(400).json({ message: "Укажите параметр filename." });
    }

    let decoded;
    try {
      decoded = decodeURIComponent(String(raw));
    } catch (_error) {
      return res.status(400).json({ message: "Некорректное имя файла." });
    }

    const filename = sanitizeBasename(decoded);
    if (!filename || filename === "file") {
      return res.status(400).json({ message: "Некорректное имя файла." });
    }

    const abs = path.resolve(path.join(VOICE_DIR, filename));
    const root = path.resolve(VOICE_DIR);
    if (!abs.startsWith(root)) {
      return res.status(400).json({ message: "Некорректное имя файла." });
    }
    if (filename === ".files-index.json" || filename.startsWith(".")) {
      return res.status(400).json({ message: "Нельзя удалить служебный файл." });
    }

    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      fs.unlinkSync(abs);
    }
    removeVoiceEntry(filename);
    return res.json({ message: "Файл удалён.", filename });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUploadedDocs,
  uploadDoc,
  deleteUploadedDoc,
  listUploadedVoice,
  uploadVoice,
  deleteUploadedVoice,
  pickUniqueFilename,
};
