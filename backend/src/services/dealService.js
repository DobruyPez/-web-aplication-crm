const BaseService = require("./baseService");
const prisma = require("../config/prisma");
const { DEAL_STAGES, dealStageLabelsList, normalizeEnum } = require("../config/workflowStandards");
const { notifyDealCreated } = require("./telegramNotificationService");
const { assertUserManagerId, assertClientId } = require("../utils/relationValidators");

const dealInclude = {
  dealDocuments: {
    orderBy: { documentId: "asc" },
    include: {
      document: {
        select: {
          id: true,
          clientId: true,
          filename: true,
          filePath: true,
        },
      },
    },
  },
};

function formatDeal(row) {
  if (!row) {
    return row;
  }
  const { dealDocuments, ...deal } = row;
  const documents = (dealDocuments || [])
    .map((link) => link.document)
    .filter(Boolean)
    .map((doc) => ({
      id: doc.id,
      clientId: doc.clientId,
      filename: doc.filename,
      filePath: doc.filePath,
    }));
  return { ...deal, documents };
}

function extractDocumentIds(payload) {
  const data = { ...payload };
  const hasDocumentIds = Object.prototype.hasOwnProperty.call(data, "documentIds");
  delete data.documentIds;
  delete data.documents;

  if (!hasDocumentIds) {
    return { data, documentIds: undefined, hasDocumentIds: false };
  }

  const raw = payload.documentIds;
  const list = Array.isArray(raw) ? raw : raw !== undefined && raw !== null && raw !== "" ? [raw] : [];
  const documentIds = list
    .map((value) => Number.parseInt(String(value), 10))
    .filter((id) => Number.isFinite(id) && id > 0);

  return { data, documentIds, hasDocumentIds: true };
}

class DealService extends BaseService {
  normalizePayload(payload, auth) {
    const { data } = extractDocumentIds(payload);
    const normalized = super.normalizePayload(data, auth);
    if (normalized.stage !== undefined && normalized.stage !== null && normalized.stage !== "") {
      normalized.stage = normalizeEnum(normalized.stage);
    }
    return normalized;
  }

  validate(payload) {
    if (payload.productName !== undefined && String(payload.productName).trim() === "") {
      const err = new Error("Укажите предмет сделки.");
      err.statusCode = 400;
      throw err;
    }

    if (payload.title !== undefined && String(payload.title).trim().length < 3) {
      const err = new Error("Поле title должно содержать минимум 3 символа.");
      err.statusCode = 400;
      throw err;
    }

    if (payload.amount !== undefined && payload.amount !== null && Number(payload.amount) < 0) {
      const err = new Error("Поле amount не может быть отрицательным.");
      err.statusCode = 400;
      throw err;
    }

    if (payload.stage !== undefined && payload.stage !== null && payload.stage !== "" && !DEAL_STAGES.includes(payload.stage)) {
      const err = new Error(`Недопустимый этап. Разрешено: ${dealStageLabelsList()}.`);
      err.statusCode = 400;
      throw err;
    }

    if (payload.closingDate !== undefined && payload.closingDate !== null && Number.isNaN(new Date(payload.closingDate).getTime())) {
      const err = new Error("Некорректная дата в поле closingDate.");
      err.statusCode = 400;
      throw err;
    }
  }

  async assertDocumentsForClient(clientId, documentIds, auth) {
    if (!documentIds || documentIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(documentIds)];
    const rows = await prisma.document.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, clientId: true, client: { select: { managerId: true } } },
    });

    if (rows.length !== uniqueIds.length) {
      const err = new Error("Один или несколько документов не найдены.");
      err.statusCode = 400;
      throw err;
    }

    for (const row of rows) {
      if (row.clientId !== clientId) {
        const err = new Error("Документ должен принадлежать выбранному клиенту сделки.");
        err.statusCode = 400;
        throw err;
      }
      if (auth.role !== "ADMIN" && row.client?.managerId !== auth.userId) {
        const err = new Error("Нет доступа к одному из выбранных документов.");
        err.statusCode = 403;
        throw err;
      }
    }
  }

  async syncDealDocuments(dealId, clientId, documentIds) {
    const ids = documentIds || [];
    await prisma.dealDocument.deleteMany({ where: { dealId } });
    if (ids.length === 0) {
      return;
    }
    await prisma.dealDocument.createMany({
      data: ids.map((documentId) => ({ dealId, documentId })),
      skipDuplicates: true,
    });
  }

  async list(auth) {
    const scope = this.buildScope(auth);
    const rows = await prisma.deal.findMany({
      where: scope,
      orderBy: { id: "asc" },
      include: dealInclude,
    });
    return rows.map(formatDeal);
  }

  async get(id, auth) {
    const entity = await prisma.deal.findUnique({
      where: { id },
      include: dealInclude,
    });
    if (!entity) {
      return null;
    }

    const scope = this.buildScope(auth);
    if (scope[this.config.managerScopeField] && entity[this.config.managerScopeField] !== scope[this.config.managerScopeField]) {
      return null;
    }

    return formatDeal(entity);
  }

  async create(payload, auth) {
    const { data, documentIds, hasDocumentIds } = extractDocumentIds(payload);
    const normalized = super.normalizePayload(data, auth);
    this.validate(normalized);

    await assertUserManagerId(normalized.managerId);
    const clientId = await assertClientId(normalized.clientId, auth);
    normalized.clientId = clientId;
    if (hasDocumentIds) {
      await this.assertDocumentsForClient(clientId, documentIds, auth);
    }

    const created = await this.repository.create(normalized);
    if (hasDocumentIds) {
      await this.syncDealDocuments(created.id, clientId, documentIds);
    }

    const result = await this.get(created.id, auth);
    await notifyDealCreated({ actorId: auth?.userId, managerId: result.managerId, deal: result }).catch(() => {});
    return result;
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    const { data, documentIds, hasDocumentIds } = extractDocumentIds(payload);
    const normalized = super.normalizePayload(data, auth);
    this.validate(normalized);

    let clientId = Number(normalized.clientId !== undefined ? normalized.clientId : current.clientId);
    if (normalized.clientId !== undefined) {
      clientId = await assertClientId(clientId, auth);
      normalized.clientId = clientId;
    }
    if (normalized.managerId !== undefined) {
      await assertUserManagerId(normalized.managerId);
    }
    if (hasDocumentIds) {
      await this.assertDocumentsForClient(clientId, documentIds, auth);
    }

    await this.repository.update(id, normalized);
    if (hasDocumentIds) {
      await this.syncDealDocuments(id, clientId, documentIds);
    }

    return this.get(id, auth);
  }
}

module.exports = DealService;
