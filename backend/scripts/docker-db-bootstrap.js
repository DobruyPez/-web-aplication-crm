/**
 * Инициализация БД в Docker: только миграция схемы, без seed данных.
 * Seed запускается отдельно через seed-bulk-docker.ps1
 */
const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const backendRoot = path.join(__dirname, "..");

async function columnExists(prisma, table, column) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function applyLegacyDealsProductName(prisma) {
  const hasProductName = await columnExists(prisma, "deals", "product_name");
  if (hasProductName) {
    await prisma.$executeRawUnsafe(`
      UPDATE public.deals
      SET product_name = title
      WHERE product_name IS NULL OR TRIM(product_name) = ''
    `);
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)
  `);

  if (await columnExists(prisma, "clients", "product_name")) {
    await prisma.$executeRawUnsafe(`
      UPDATE public.deals d
      SET product_name = c.product_name
      FROM public.clients c
      WHERE d.client_id = c.id
        AND c.product_name IS NOT NULL
        AND TRIM(c.product_name) <> ''
        AND (d.product_name IS NULL OR TRIM(d.product_name) = '')
    `);
  }

  await prisma.$executeRawUnsafe(`
    UPDATE public.deals
    SET product_name = title
    WHERE product_name IS NULL OR TRIM(product_name) = ''
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.deals
    ALTER COLUMN product_name SET NOT NULL
  `);

  if (await columnExists(prisma, "clients", "product_name")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.clients DROP COLUMN product_name
    `);
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("[db-bootstrap] проверка legacy-схемы (deals.product_name)…");
    await applyLegacyDealsProductName(prisma);
    console.log("[db-bootstrap] legacy OK");
  } finally {
    await prisma.$disconnect();
  }

  // Применяем схему без данных
  console.log("[db-bootstrap] применение схемы БД...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    cwd: backendRoot,
  });
  
  console.log("[db-bootstrap] схема готова, данные не заполнялись");
  console.log("[db-bootstrap] запустите .\\scripts\\seed-bulk-docker.ps1 для наполнения данными");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});