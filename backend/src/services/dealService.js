const BaseService = require("./baseService");
const { DEAL_STAGES, normalizeEnum } = require("../config/workflowStandards");
const { notifyDealCreated } = require("./telegramNotificationService");

class DealService extends BaseService {
  normalizePayload(payload, auth) {
    const data = super.normalizePayload(payload, auth);
    if (data.stage !== undefined && data.stage !== null && data.stage !== "") {
      data.stage = normalizeEnum(data.stage);
    }
    return data;
  }

  validate(payload) {
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
      const err = new Error(`Недопустимый stage. Разрешено: ${DEAL_STAGES.join(", ")}.`);
      err.statusCode = 400;
      throw err;
    }

    if (payload.closingDate !== undefined && payload.closingDate !== null && Number.isNaN(new Date(payload.closingDate).getTime())) {
      const err = new Error("Некорректная дата в поле closingDate.");
      err.statusCode = 400;
      throw err;
    }
  }

  async create(payload, auth) {
    const data = this.normalizePayload(payload, auth);
    this.validate(data);
    const created = await this.repository.create(data);
    await notifyDealCreated({ actorId: auth?.userId, managerId: created.managerId, deal: created }).catch(() => {});
    return created;
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    const data = this.normalizePayload(payload, auth);
    this.validate(data);
    return this.repository.update(id, data);
  }
}

module.exports = DealService;
