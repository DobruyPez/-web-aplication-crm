const { loadEnv } = require("../loadEnv");
loadEnv();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL_MANAGER || "";
}

const { PrismaClient } = require("@prisma/client");

// Создаём два экземпляра PrismaClient для разных ролей
const prismaAdmin = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL,
    },
  },
});

const prismaManager = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_MANAGER || process.env.DATABASE_URL,
    },
  },
});

// По умолчанию экспортируем admin
const prisma = prismaAdmin;

module.exports = prisma;
module.exports.prismaAdmin = prismaAdmin;
module.exports.prismaManager = prismaManager;
