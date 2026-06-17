/**
 * Сброс пароля демо-учёток (*@demo.crm.by) на 1234.
 * Запуск: cd backend && node scripts/reset-bulk-passwords.js
 */
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/authPassword");
const { SEED_EMAIL_DOMAIN } = require("./seed-bulk-by-fixtures");

const PASSWORD =
  process.env.DEMO_SEED_PASSWORD || process.env.BULK_SEED_PASSWORD || "1234";

async function main() {
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
  require("dotenv").config({ path: path.join(__dirname, "../../.env") });

  const prisma = new PrismaClient();
  const passwordHash = hashPassword(PASSWORD);

  try {
    const result = await prisma.user.updateMany({
      where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
      data: { password: passwordHash },
    });
    console.log(`Пароль ${PASSWORD} установлен для ${result.count} учёток *@${SEED_EMAIL_DOMAIN}`);
    console.log(`Админ: admin@${SEED_EMAIL_DOMAIN}`);
    console.log("Менеджер: см. список пользователей (email вида ivan.petrov@demo.crm.by)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
