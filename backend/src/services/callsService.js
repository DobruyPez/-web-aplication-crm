const BaseService = require("./baseService");
const prisma = require("../config/prisma");
const fs = require("fs");
const path = require("path");
const { VOICE_DIR } = require("../utils/uploadsPaths");

const CALL_PAYLOAD_KEYS = [
  "clientId",
  "callerId",
  "direction",
  "status",
  "duration",
  "recordingUrl",
  "startedAt",
  "endedAt",
];

class CallsService extends BaseService {
  normalizeRecordingPath(value) {
    if (value === undefined || value === null) {
      return value;
    }
    const text = String(value).trim();
    if (!text) {
      return null;
    }

    try {
      if (/^https?:\/\//i.test(text)) {
        const url = new URL(text);
        const maybePath = url.pathname || "";
        if (maybePath.startsWith("/uploads/voice/")) {
          return maybePath;
        }
      }
    } catch (_error) {
      // keep current flow for non-url values
    }

    if (text.startsWith("/uploads/voice/")) {
      return text;
    }

    return `/uploads/voice/${path.basename(text)}`;
  }

  assertRecordingOnDisk(recordingPath) {
    if (!recordingPath) {
      return;
    }
    const filename = path.basename(String(recordingPath));
    if (!filename) {
      const err = new Error("Некорректная ссылка на запись.");
      err.statusCode = 400;
      throw err;
    }
    const abs = path.join(VOICE_DIR, filename);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      const err = new Error(`Файл голосовой записи "${filename}" не найден на сервере.`);
      err.statusCode = 400;
      throw err;
    }
  }

  normalizePayload(payload, auth) {
    const picked = {};
    for (const key of CALL_PAYLOAD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        picked[key] = payload[key];
      }
    }
    const data = super.normalizePayload(picked, auth);
    if (Object.prototype.hasOwnProperty.call(data, "recordingUrl")) {
      data.recordingUrl = this.normalizeRecordingPath(data.recordingUrl);
    }
    return data;
  }

  buildScope(auth) {
    if (auth.role === "ADMIN" || !this.config.managerScopeField) {
      return {};
    }
    return {
      client: {
        managerId: auth.userId,
      },
    };
  }

  async list(auth) {
    return prisma.call.findMany({
      where: this.buildScope(auth),
      orderBy: { id: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        caller: { select: { id: true, fullName: true } },
      },
    });
  }

  async get(id, auth) {
    const entity = await this.repository.findById(id);
    if (!entity) {
      return null;
    }

    if (auth.role === "ADMIN") {
      return entity;
    }

    const client = await prisma.client.findUnique({ where: { id: entity.clientId } });
    if (!client || client.managerId !== auth.userId) {
      return null;
    }

    return entity;
  }

  async create(payload, auth) {
    if (auth.role === "MANAGER") {
      const err = new Error(
        "Менеджер не может создавать звонки вручную. Используйте видеоконференцию.",
      );
      err.statusCode = 403;
      throw err;
    }

    const data = this.normalizePayload(payload, auth);
    this.assertRecordingOnDisk(data.recordingUrl);

    return this.repository.create(data);
  }

  /** Создание звонка после завершения видеосессии (только для внутреннего вызова). */
  async createFromVideoSession(payload, auth) {
    const data = this.normalizePayload(payload, auth);
    this.assertRecordingOnDisk(data.recordingUrl);

    if (auth.role === "MANAGER") {
      data.callerId = auth.userId;
      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client || client.managerId !== auth.userId) {
        const err = new Error("Клиент не найден или недоступен.");
        err.statusCode = 403;
        throw err;
      }
    }

    return this.repository.create(data);
  }

  async update(id, payload, auth) {
    if (auth.role === "MANAGER") {
      const err = new Error("Менеджер не может изменять звонки.");
      err.statusCode = 403;
      throw err;
    }
    const data = this.normalizePayload(payload, auth);
    this.assertRecordingOnDisk(data.recordingUrl);
    return this.repository.update(id, data);
  }

  async remove(id, auth) {
    if (auth.role === "MANAGER") {
      const err = new Error("Менеджер не может удалять звонки.");
      err.statusCode = 403;
      throw err;
    }
    return super.remove(id, auth);
  }
}

module.exports = CallsService;
