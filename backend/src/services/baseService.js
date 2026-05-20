class BaseService {
  constructor(repository, config) {
    this.repository = repository;
    this.config = config;
  }

  buildScope(auth) {
    if (auth.role === "ADMIN" || !this.config.managerScopeField) {
      return {};
    }

    return { [this.config.managerScopeField]: auth.userId };
  }

  normalizePayload(payload, auth) {
    const data = { ...payload };

    const dateLikeFields = ["dueDate", "closingDate", "startedAt", "endedAt"];
    for (const field of dateLikeFields) {
      if (typeof data[field] === "string") {
        const parsed = new Date(data[field]);
        if (!Number.isNaN(parsed.getTime())) {
          data[field] = parsed;
        }
      }
    }

    if (auth.role === "MANAGER" && this.config.managerScopeField) {
      data[this.config.managerScopeField] = auth.userId;
    }

    return data;
  }

  async list(auth) {
    return this.repository.findMany(this.buildScope(auth));
  }

  async get(id, auth) {
    const entity = await this.repository.findById(id);
    if (!entity) {
      return null;
    }

    const scope = this.buildScope(auth);
    if (scope[this.config.managerScopeField] && entity[this.config.managerScopeField] !== scope[this.config.managerScopeField]) {
      return null;
    }

    return entity;
  }

  async create(payload, auth) {
    return this.repository.create(this.normalizePayload(payload, auth));
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    return this.repository.update(id, this.normalizePayload(payload, auth));
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

module.exports = BaseService;
