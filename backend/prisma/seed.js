/**
 * Начальные данные для пустой БД (Docker / локально после db push).
 * Админ: admin@crm.by / 1234
 * Менеджеры: manager1@crm.by, manager2@crm.by / 1234
 * Демо: клиенты, сделки, задачи, звонки, документы (см. seedDemoData.js).
 *
 * Отключить демо: CRM_SEED_DEMO_DATA=false
 *
 * Переменные окружения задаёт `prisma db seed` / Docker — без dotenv.
 */
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/authPassword");
const { seedDemoData } = require("./seedDemoData");

const prisma = new PrismaClient();

const PASSWORD_PLAIN = "1234";
const SEED_DEMO_ENABLED = String(process.env.CRM_SEED_DEMO_DATA ?? "true").toLowerCase() !== "false";

const ADMIN = {
  email: "admin@crm.by",
  fullName: "Администратор",
  role: "admin",
};

const MANAGERS = [
  { email: "manager1@crm.by", fullName: "Менеджер 1" },
  { email: "manager2@crm.by", fullName: "Менеджер 2" },
];

async function ensureUser({ email, fullName, role }) {
  const passwordHash = hashPassword(PASSWORD_PLAIN);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    await prisma.user.create({
      data: {
        fullName,
        email,
        password: passwordHash,
        role,
        phone: null,
      },
    });
    console.log(`Seed: создан ${email} (${role}, пароль: ${PASSWORD_PLAIN}).`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: {
      fullName,
      role,
      password: passwordHash,
    },
  });
  console.log(`Seed: обновлён ${email} (имя, роль, пароль: ${PASSWORD_PLAIN}).`);
}

async function main() {
  await ensureUser({ ...ADMIN });
  for (const m of MANAGERS) {
    await ensureUser({ ...m, role: "manager" });
  }

  if (SEED_DEMO_ENABLED) {
    await seedDemoData(prisma);
  } else {
    console.log("Seed: демо-данные отключены (CRM_SEED_DEMO_DATA=false).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
