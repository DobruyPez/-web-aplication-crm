/**
 * Массовое наполнение CRM (Беларусь): осмысленные данные для проверки фильтров.
 *
 * Запуск (из backend/):
 *   node scripts/seed-bulk-load.js --clear
 *   node scripts/seed-bulk-load.js --clear --docs-dir ./uploads/docs --calls-dir ./uploads/video
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/authPassword");
const { isAllowedUploadExtension } = require("../src/utils/allowedUploadDocExtensions");
const { isAllowedVoiceExtension } = require("../src/utils/allowedUploadVoiceExtensions");
const { DOCS_DIR, VOICE_DIR, ensureVoiceDir } = require("../src/utils/uploadsPaths");
const {
  SEED_EMAIL_DOMAIN,
  CLIENT_NOTES_TAG,
  DEAL_DESC_CITY_PREFIX,
  buildAdminProfile,
  buildManagerProfile,
  buildClientProfile,
  buildContactPersonsForClient,
  buildTaskRow,
  buildDealRow,
  callStatusForIndex,
  syntheticDocFilename,
  printFilterHints,
} = require("./seed-bulk-by-fixtures");

const DEFAULT_PASSWORD =
  process.env.DEMO_SEED_PASSWORD || process.env.BULK_SEED_PASSWORD || "1234";

const COUNTS = {
  admins: 2,
  managers: 100,
  clientsPerManager: 10,
  tasksPerManager: 150,
  dealsPerClient: 1,
  callsPerClientMin: 5,
  callsPerClientMax: 15,
  docsPerClientMin: 5,
  docsPerClientMax: 15,
};

const BATCH = 500;

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".docm": "application/vnd.ms-word.document.macroEnabled.12",
  ".dot": "application/msword",
  ".dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  ".rtf": "application/rtf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".webm": "audio/webm",
  ".opus": "audio/opus",
};

function parseArgs(argv) {
  const opts = {
    clear: false,
    docsDir: null,
    callsDir: null,
    voiceDir: VOICE_DIR,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--clear") opts.clear = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--docs-dir" && argv[i + 1]) {
      opts.docsDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (a === "--calls-dir" && argv[i + 1]) {
      opts.callsDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (a === "--voice-dir" && argv[i + 1]) {
      opts.voiceDir = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return opts;
}

function callsForClientIndex(globalClientIdx) {
  return COUNTS.callsPerClientMin + (globalClientIdx % (COUNTS.callsPerClientMax - COUNTS.callsPerClientMin + 1));
}

function docsForClientIndex(globalClientIdx) {
  return COUNTS.docsPerClientMin + ((globalClientIdx * 7) % (COUNTS.docsPerClientMax - COUNTS.docsPerClientMin + 1));
}

function listFilesInDir(dir, isAllowedExt) {
  if (!dir || !fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith(".") && name !== ".files-index.json")
    .map((name) => {
      const abs = path.join(dir, name);
      if (!fs.statSync(abs).isFile()) {
        return null;
      }
      const ext = path.extname(name).toLowerCase();
      if (!isAllowedExt(ext)) {
        return null;
      }
      const stat = fs.statSync(abs);
      return {
        filename: name,
        abs,
        fileSize: stat.size,
        mimeType: MIME_BY_EXT[ext] || "application/octet-stream",
      };
    })
    .filter(Boolean);
}

function ensureVoiceFilesFromSource(sourceDir, voiceDir) {
  ensureVoiceDir();
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    return 0;
  }
  if (path.resolve(sourceDir) === path.resolve(voiceDir)) {
    return 0;
  }
  let copied = 0;
  for (const file of listFilesInDir(sourceDir, isAllowedVoiceExtension)) {
    const dest = path.join(voiceDir, file.filename);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(file.abs, dest);
      copied += 1;
    }
  }
  return copied;
}

function pickCyclic(list, index) {
  if (!list.length) {
    return null;
  }
  return list[index % list.length];
}

async function clearDatabase(prisma) {
  console.log("  Clearing tables...");
  
  // Delete in correct order (child tables first)
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "client_contact_points" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "client_contact_persons" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "deal_documents" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "video_sessions" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "client_invite_tokens" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "documents" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "calls" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "tasks" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "deals" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "clients" CASCADE;`).catch(() => {});
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users" CASCADE;`).catch(() => {});
  
  console.log("  All tables cleared");
}

async function upsertUsers(prisma, users) {
  let created = 0;
  for (const user of users) {
    try {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          fullName: user.fullName,
          password: user.password,
          role: user.role,
          phone: user.phone,
        },
        create: user,
      });
      created++;
    } catch (e) {
      console.log(`    Error upserting ${user.email}: ${e.message}`);
    }
  }
  return created;
}

async function main() {
  const opts = parseArgs(process.argv);
  const backendRoot = path.join(__dirname, "..");
  const repoRoot = path.join(backendRoot, "..");

  require("dotenv").config({ path: path.join(backendRoot, ".env") });
  require("dotenv").config({ path: path.join(repoRoot, ".env") });

  if (!process.env.DATABASE_URL) {
    console.error("Задайте DATABASE_URL в backend/.env или корневом .env");
    process.exit(1);
  }

  const docsScanDir = opts.docsDir || DOCS_DIR;
  const callsSourceDir = opts.callsDir || path.join(backendRoot, "uploads", "video");
  const voiceDir = opts.voiceDir || VOICE_DIR;

  const copiedVoice = ensureVoiceFilesFromSource(callsSourceDir, voiceDir);
  const fallbackVoiceDir = path.join(repoRoot, "uploads", "voice");
  if (path.resolve(callsSourceDir) !== path.resolve(fallbackVoiceDir)) {
    ensureVoiceFilesFromSource(fallbackVoiceDir, voiceDir);
  }

  const docFiles = listFilesInDir(docsScanDir, isAllowedUploadExtension);
  const voiceFiles = listFilesInDir(voiceDir, isAllowedVoiceExtension);

  const totalClients = COUNTS.managers * COUNTS.clientsPerManager;
  const totalTasks = COUNTS.managers * COUNTS.tasksPerManager;
  const totalDeals = totalClients * COUNTS.dealsPerClient;

  let totalCalls = 0;
  let totalDocs = 0;
  for (let c = 0; c < totalClients; c += 1) {
    totalCalls += callsForClientIndex(c);
    totalDocs += docsForClientIndex(c);
  }

  console.log("=== CRM демо-наполнение (Беларусь, для фильтров) ===");
  console.log(`Метка клиентов в заметках: ${CLIENT_NOTES_TAG}`);
  console.log(`Учётки: *@${SEED_EMAIL_DOMAIN}`);
  console.log(`Админов: ${COUNTS.admins}, менеджеров: ${COUNTS.managers}, клиентов: ${totalClients}`);
  console.log(`Сделок: ${totalDeals}, задач: ${totalTasks}, звонков: ~${totalCalls}, документов: ~${totalDocs}`);
  console.log(`Документы с диска (${docsScanDir}): ${docFiles.length} файл(ов)`);
  console.log(`Записи звонков (${voiceDir}): ${voiceFiles.length} файл(ов), скопировано: ${copiedVoice}`);

  if (opts.dryRun) {
    printFilterHints();
    console.log("Dry-run: выход без записи в БД.");
    return;
  }

  const prisma = new PrismaClient();
  const passwordHash = hashPassword(DEFAULT_PASSWORD);
  const now = new Date();

  try {
    if (opts.clear) {
      console.log("Очистка таблиц…");
      await clearDatabase(prisma);
    }

    // Create users with upsert
    console.log("Пользователи…");
    const users = [];
    for (let a = 1; a <= COUNTS.admins; a += 1) {
      const profile = buildAdminProfile(a);
      users.push({
        fullName: profile.fullName,
        email: profile.email,
        password: passwordHash,
        role: "admin",
        phone: profile.phone,
      });
    }
    for (let m = 1; m <= COUNTS.managers; m += 1) {
      const profile = buildManagerProfile(m);
      users.push({
        fullName: profile.fullName,
        email: profile.email,
        password: passwordHash,
        role: "manager",
        phone: profile.phone,
      });
    }
    
    const usersCreated = await upsertUsers(prisma, users);
    console.log(`  Создано/обновлено пользователей: ${usersCreated}`);

    const userRows = await prisma.user.findMany({
      where: {
        email: { endsWith: `@${SEED_EMAIL_DOMAIN}` },
      },
      orderBy: { id: "asc" },
      select: { id: true, email: true, role: true, fullName: true },
    });
    const admins = userRows.filter((u) => u.role === "admin");
    const managers = userRows.filter((u) => u.role === "manager");

    // Create clients
    console.log("Клиенты…");
    const clients = [];
    const clientProfiles = [];
    let globalClientIdx = 0;

    for (let mi = 0; mi < managers.length; mi += 1) {
      const manager = managers[mi];
      for (let ci = 0; ci < COUNTS.clientsPerManager; ci += 1) {
        globalClientIdx += 1;
        const profile = buildClientProfile(globalClientIdx, mi);
        clientProfiles.push(profile);
        clients.push({
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          address: profile.address,
          notes: profile.notes,
          managerId: manager.id,
        });
      }
    }

    for (let i = 0; i < clients.length; i += BATCH) {
      const batch = clients.slice(i, i + BATCH);
      await prisma.client.createMany({ data: batch });
      console.log(`    Клиентов: ${Math.min(i + BATCH, clients.length)} / ${clients.length}`);
    }

    const clientRows = await prisma.client.findMany({
      where: { notes: { contains: CLIENT_NOTES_TAG } },
      orderBy: { id: "asc" },
      select: { id: true, managerId: true },
    });

    // Create deals
    console.log("Сделки…");
    const deals = [];
    for (let ci = 0; ci < clientRows.length; ci += 1) {
      const client = clientRows[ci];
      const profile = clientProfiles[ci];
      deals.push(buildDealRow(ci, client.id, client.managerId, profile, now));
    }

    for (let i = 0; i < deals.length; i += BATCH) {
      const batch = deals.slice(i, i + BATCH);
      await prisma.deal.createMany({ data: batch });
      console.log(`    Сделок: ${Math.min(i + BATCH, deals.length)} / ${deals.length}`);
    }

    const dealRows = await prisma.deal.findMany({
      where: { description: { contains: DEAL_DESC_CITY_PREFIX } },
      select: { id: true, clientId: true },
    });
    const dealByClientId = new Map();
    for (const d of dealRows) {
      dealByClientId.set(d.clientId, d.id);
    }

    // Create tasks
    console.log("Задачи…");
    const tasks = [];
    const clientsByManager = new Map();
    for (const c of clientRows) {
      if (!clientsByManager.has(c.managerId)) {
        clientsByManager.set(c.managerId, []);
      }
      clientsByManager.get(c.managerId).push(c.id);
    }

    for (const manager of managers) {
      const clientIds = clientsByManager.get(manager.id) || [];
      for (let t = 0; t < COUNTS.tasksPerManager; t += 1) {
        const clientId = clientIds[t % clientIds.length];
        const dealId = dealByClientId.get(clientId) ?? null;
        tasks.push(buildTaskRow(t, manager, clientId, dealId, now));
      }
    }

    for (let i = 0; i < tasks.length; i += BATCH) {
      const batch = tasks.slice(i, i + BATCH);
      await prisma.task.createMany({ data: batch });
      console.log(`    Задач: ${Math.min(i + BATCH, tasks.length)} / ${tasks.length}`);
    }

    // Create calls
    console.log("Звонки…");
    const calls = [];
    let callFileIdx = 0;
    for (let ci = 0; ci < clientRows.length; ci += 1) {
      const client = clientRows[ci];
      const nCalls = callsForClientIndex(ci);
      for (let k = 0; k < nCalls; k += 1) {
        const voice = pickCyclic(voiceFiles, callFileIdx);
        callFileIdx += 1;
        const started = new Date(now.getTime() - (ci * 20 + k) * 3600000);
        const duration = callStatusForIndex(k) === "completed" ? 90 + ((ci + k) % 480) : null;
        calls.push({
          clientId: client.id,
          callerId: client.managerId,
          direction: k % 3 === 0 ? "in" : "out",
          status: callStatusForIndex(k),
          duration,
          recordingUrl: voice && callStatusForIndex(k) === "completed" ? `/uploads/voice/${voice.filename}` : null,
          startedAt: started,
          endedAt: duration ? new Date(started.getTime() + duration * 1000) : null,
        });
      }
    }

    for (let i = 0; i < calls.length; i += BATCH) {
      const batch = calls.slice(i, i + BATCH);
      await prisma.call.createMany({ data: batch });
      console.log(`    Звонков: ${Math.min(i + BATCH, calls.length)} / ${calls.length}`);
    }

    // Create documents
    console.log("Документы…");
    const documents = [];
    let docFileIdx = 0;
    for (let ci = 0; ci < clientRows.length; ci += 1) {
      const client = clientRows[ci];
      const nDocs = docsForClientIndex(ci);
      for (let k = 0; k < nDocs; k += 1) {
        const doc = pickCyclic(docFiles, docFileIdx);
        docFileIdx += 1;
        const filename = doc ? doc.filename : syntheticDocFilename(clientProfiles[ci], k, ci);
        documents.push({
          clientId: client.id,
          uploaderId: client.managerId,
          filename,
          filePath: `/uploads/docs/${filename}`,
          fileSize: doc?.fileSize ?? 8192 + (k * 512),
          mimeType: doc?.mimeType ?? "application/pdf",
          uploadedAt: new Date(now.getTime() - (ci * 10 + k) * 60000),
        });
      }
    }

    for (let i = 0; i < documents.length; i += BATCH) {
      const batch = documents.slice(i, i + BATCH);
      await prisma.document.createMany({ data: batch });
      console.log(`    Документов: ${Math.min(i + BATCH, documents.length)} / ${documents.length}`);
    }

    console.log("");
    console.log("Готово.");
    console.log(`Пароль учёток *@${SEED_EMAIL_DOMAIN}: ${DEFAULT_PASSWORD}`);
    console.log("Примеры входа:");
    console.log(`  admin@${SEED_EMAIL_DOMAIN}`);
    const sampleManager = buildManagerProfile(1);
    console.log(`  ${sampleManager.email} (${sampleManager.fullName})`);
    printFilterHints();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});