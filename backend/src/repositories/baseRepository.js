class BaseRepository {
  constructor(prisma, modelName) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  get model() {
    return this.prisma[this.modelName];
  }

  async findMany(where = {}) {
    return this.model.findMany({ where, orderBy: { id: "asc" } });
  }

  async findById(id) {
    return this.model.findUnique({ where: { id } });
  }

  async create(data) {
    return this.model.create({ data });
  }

  async update(id, data) {
    return this.model.update({ where: { id }, data });
  }

  async remove(id) {
    return this.model.delete({ where: { id } });
  }
}

module.exports = BaseRepository;
