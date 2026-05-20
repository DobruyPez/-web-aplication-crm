const BaseService = require("./baseService");
const { hashPassword } = require("../utils/authPassword");
const sanitizeUser = require("../utils/sanitizeUser");

const isAdminRole = (role) => String(role || "").trim().toLowerCase() === "admin";

class UserService extends BaseService {
  normalizePayload(payload, auth) {
    const data = super.normalizePayload(payload, auth);
    delete data.role;

    if (typeof data.password === "string" && data.password.length > 0) {
      data.password = hashPassword(data.password);
    } else {
      delete data.password;
    }
    if (data.password === null) {
      delete data.password;
    }
    if (typeof data.telegramLink === "string") {
      const clean = data.telegramLink.trim();
      data.telegramLink = clean.length > 0 ? clean : null;
    }
    if (typeof data.telegramChatId === "string") {
      const clean = data.telegramChatId.trim();
      data.telegramChatId = clean.length > 0 ? clean : null;
    }
    return data;
  }

  async list(auth) {
    const rows = await this.repository.findMany(this.buildScope(auth));
    return rows.map(sanitizeUser);
  }

  async get(id, auth) {
    const entity = await super.get(id, auth);
    return entity ? sanitizeUser(entity) : null;
  }

  async create(payload, auth) {
    const data = this.normalizePayload(payload, auth);
    data.role = "manager";
    const created = await this.repository.create(data);
    return sanitizeUser(created);
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }
    if (isAdminRole(current.role)) {
      const err = new Error("Учётную запись администратора можно менять только в базе данных.");
      err.statusCode = 403;
      throw err;
    }
    const updated = await super.update(id, payload, auth);
    return updated ? sanitizeUser(updated) : null;
  }

  async remove(id, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }
    if (isAdminRole(current.role)) {
      const err = new Error("Нельзя удалить учётную запись администратора.");
      err.statusCode = 403;
      throw err;
    }
    const removed = await super.remove(id, auth);
    return removed ? sanitizeUser(removed) : null;
  }
}

module.exports = UserService;
