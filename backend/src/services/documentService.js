const fs = require("fs");
const path = require("path");
const BaseService = require("./baseService");
const prisma = require("../config/prisma");
const { DOCS_DIR } = require("../utils/uploadsPaths");

class DocumentService extends BaseService {
  buildScope(auth) {
    if (auth.role === "ADMIN" || !auth?.userId) {
      return {};
    }
    return {
      client: {
        managerId: auth.userId,
      },
    };
  }

  async assertClientAccess(clientId, auth) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      const err = new Error("Клиент не найден.");
      err.statusCode = 404;
      throw err;
    }
    if (auth.role !== "ADMIN" && client.managerId !== auth.userId) {
      const err = new Error("Нет доступа к этому клиенту.");
      err.statusCode = 403;
      throw err;
    }
    return client;
  }

  assertFileOnDisk(filename) {
    const base = path.basename(String(filename || ""));
    if (!base) {
      const err = new Error("Имя файла обязательно.");
      err.statusCode = 400;
      throw err;
    }
    const abs = path.join(DOCS_DIR, base);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      const err = new Error(`Файл "${base}" не найден в каталоге загрузок. Сначала загрузите файл на вкладке «Загрузка файлов».`);
      err.statusCode = 400;
      throw err;
    }
  }

  normalizePayload(payload, auth) {
    const data = { ...payload };

    const dateLikeFields = ["dueDate", "closingDate", "startedAt", "endedAt", "uploadedAt"];
    for (const field of dateLikeFields) {
      if (typeof data[field] === "string") {
        const parsed = new Date(data[field]);
        if (!Number.isNaN(parsed.getTime())) {
          data[field] = parsed;
        }
      }
    }

    if (data.filename !== undefined && data.filename !== null) {
      data.filename = path.basename(String(data.filename));
    }
    if (data.filePath !== undefined && data.filePath !== null && data.filename) {
      data.filePath = `/uploads/docs/${data.filename}`;
    }

    if (auth?.userId) {
      if (auth.role === "MANAGER") {
        data.uploaderId = auth.userId;
      } else if (data.uploaderId === undefined || data.uploaderId === null) {
        data.uploaderId = auth.userId;
      }
    }

    return data;
  }

  validateBusiness(data) {
    if (data.filename) {
      this.assertFileOnDisk(data.filename);
    }
  }

  async list(auth) {
    return prisma.document.findMany({
      where: this.buildScope(auth),
      orderBy: { id: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
      },
    });
  }

  async get(id, auth) {
    const entity = await prisma.document.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, managerId: true } },
        uploader: { select: { id: true, fullName: true } },
      },
    });
    if (!entity) {
      return null;
    }

    if (auth.role === "ADMIN") {
      return entity;
    }

    if (!entity.client || entity.client.managerId !== auth.userId) {
      return null;
    }

    return entity;
  }

  async create(payload, auth) {
    const data = this.normalizePayload(payload, auth);
    if (data.clientId !== undefined && data.clientId !== null) {
      await this.assertClientAccess(data.clientId, auth);
    }
    this.validateBusiness(data);
    return this.repository.create(data);
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    const data = this.normalizePayload(payload, auth);
    if (data.clientId !== undefined && data.clientId !== null) {
      await this.assertClientAccess(data.clientId, auth);
    }
    if (data.filename !== undefined) {
      this.validateBusiness(data);
    }
    return this.repository.update(id, data);
  }

  async remove(id, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    await this.repository.remove(id);
    return current;
  }
}

module.exports = DocumentService;
