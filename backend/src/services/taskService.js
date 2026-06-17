const BaseService = require("./baseService");
const { TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabelsList, normalizeEnum } = require("../config/workflowStandards");
const { notifyTaskCreated, notifyOverdueTask } = require("./telegramNotificationService");

class TaskService extends BaseService {
  normalizePayload(payload, auth) {
    const data = super.normalizePayload(payload, auth);

    if (data.status !== undefined && data.status !== null && data.status !== "") {
      data.status = normalizeEnum(data.status);
    }
    if (data.priority !== undefined && data.priority !== null && data.priority !== "") {
      data.priority = normalizeEnum(data.priority);
    }
    return data;
  }

  validate(payload) {
    if (payload.title !== undefined && String(payload.title).trim().length < 3) {
      const err = new Error("Поле title должно содержать минимум 3 символа.");
      err.statusCode = 400;
      throw err;
    }

    if (
      payload.status !== undefined &&
      payload.status !== null &&
      payload.status !== "" &&
      !TASK_STATUSES.includes(payload.status)
    ) {
      const err = new Error(`Недопустимый status. Разрешено: ${TASK_STATUSES.join(", ")}.`);
      err.statusCode = 400;
      throw err;
    }

    if (
      payload.priority !== undefined &&
      payload.priority !== null &&
      payload.priority !== "" &&
      !TASK_PRIORITIES.includes(payload.priority)
    ) {
      const err = new Error(`Недопустимый приоритет. Разрешено: ${taskPriorityLabelsList()}.`);
      err.statusCode = 400;
      throw err;
    }

    if (payload.dueDate !== undefined && payload.dueDate !== null && Number.isNaN(new Date(payload.dueDate).getTime())) {
      const err = new Error("Некорректная дата в поле dueDate.");
      err.statusCode = 400;
      throw err;
    }
  }

  async create(payload, auth) {
    const data = this.normalizePayload(payload, auth);
    this.validate(data);
    const created = await this.repository.create(data);
    await notifyTaskCreated({ actorId: auth?.userId, assigneeId: created.authorId, task: created }).catch(() => {});
    await notifyOverdueTask({ assigneeId: created.authorId, task: created }).catch(() => {});
    return created;
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    const data = this.normalizePayload(payload, auth);
    this.validate(data);
    const updated = await this.repository.update(id, data);
    await notifyOverdueTask({ assigneeId: updated.authorId, task: updated }).catch(() => {});
    return updated;
  }
}

module.exports = TaskService;
