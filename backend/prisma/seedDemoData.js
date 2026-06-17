/**
 * Демо-данные для Docker / prisma db seed (клиенты, сделки, задачи, звонки, документы).
 * Идемпотентно: повторный seed не дублирует записи (маркер в clients.notes).
 */

const DEMO_MARKER = "Docker demo seed";

/** +37529 + 7 цифр → 9 цифр национальной части после 375. */
function belarusMobile(seed) {
  const n = Math.abs(Number(seed) || 0) % 10_000_000;
  return `+37529${String(n).padStart(7, "0")}`;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function atUtcHour(base, hour = 12) {
  const d = new Date(base);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

async function ensureDemoClientContactPersons(prisma, client) {
  const count = await prisma.clientContactPerson.count({ where: { clientId: client.id } });
  if (count > 0) {
    return false;
  }

  const phoneValue = String(client.phone || "").trim();
  const emailValue = String(client.email || "").trim().toLowerCase();
  const phoneSeed = client.id;

  const persons = [
    {
      fullName: "Основной контакт",
      role: null,
      sortOrder: 0,
      channels: [
        ...(phoneValue ? [{ type: "phone", value: phoneValue, sortOrder: 0 }] : []),
        ...(emailValue ? [{ type: "email", value: emailValue, sortOrder: 1 }] : []),
      ],
    },
    {
      fullName: "Бухгалтерия",
      role: null,
      sortOrder: 1,
      channels: [{ type: "fax", value: belarusMobile(2_000_000 + phoneSeed), sortOrder: 0 }],
    },
    {
      fullName: "Менеджер проекта",
      role: null,
      sortOrder: 2,
      channels: [{ type: "telegram", value: "@demo_client", sortOrder: 0 }],
    },
    {
      fullName: "Компания",
      role: "Сайт",
      sortOrder: 3,
      channels: [{ type: "website", value: "https://demo.by", sortOrder: 0 }],
    },
  ].filter((person) => person.channels.length > 0);

  for (const [personIndex, person] of persons.entries()) {
    await prisma.clientContactPerson.create({
      data: {
        clientId: client.id,
        fullName: person.fullName,
        role: person.role,
        sortOrder: personIndex,
        channels: {
          create: person.channels.map((channel, channelIndex) => ({
            clientId: client.id,
            type: channel.type,
            value: channel.value,
            contactName: person.fullName,
            sortOrder: channelIndex,
          })),
        },
      },
    });
  }
  return true;
}

async function seedDemoData(prisma) {
  const existingClients = await prisma.client.findMany({
    where: { notes: { contains: DEMO_MARKER } },
    orderBy: { id: "asc" },
  });
  if (existingClients.length > 0) {
    let backfilled = 0;
    for (const client of existingClients) {
      if (await ensureDemoClientContactPersons(prisma, client)) {
        backfilled += 1;
      }
    }
    if (backfilled > 0) {
      console.log(`Seed: контакты добавлены ${backfilled} демо-клиентам.`);
    } else {
      console.log("Seed: демо-данные уже есть, пропуск.");
    }
    return;
  }

  const managers = await prisma.user.findMany({
    where: { role: "manager" },
    orderBy: { id: "asc" },
  });
  if (managers.length === 0) {
    console.log("Seed: нет менеджеров — демо-данные не созданы.");
    return;
  }

  const today = new Date();
  const closingRisk = addDays(today, 3);
  const dueOverdue = new Date("2000-01-15T10:00:00.000Z");
  const dueToday = atUtcHour(today, 23);
  const dueWeek = addDays(atUtcHour(today, 12), 4);

  let clientsCount = 0;
  let dealsCount = 0;
  let tasksCount = 0;
  let callsCount = 0;
  let documentsCount = 0;

  for (let mi = 0; mi < managers.length; mi += 1) {
    const manager = managers[mi];

    for (let ci = 0; ci < 2; ci += 1) {
      const phoneSeed = mi * 100 + ci + 1;
      const phoneValue = belarusMobile(1_000_000 + phoneSeed);
      const emailValue = `demo.client.${manager.id}.${ci}@crm.by`;
      const client = await prisma.client.create({
        data: {
          name: `DemoCo (${manager.fullName})`,
          phone: phoneValue,
          email: emailValue,
          address: "г. Минск",
          notes: `${DEMO_MARKER}. Менеджер: ${manager.email}`,
          managerId: manager.id,
          contactPersons: {
            create: [
              {
                fullName: "Основной контакт",
                sortOrder: 0,
                channels: {
                  create: [
                    { type: "phone", value: phoneValue, contactName: "Основной контакт", sortOrder: 0 },
                    { type: "email", value: emailValue, contactName: "Основной контакт", sortOrder: 1 },
                  ],
                },
              },
              {
                fullName: "Бухгалтерия",
                sortOrder: 1,
                channels: {
                  create: [
                    {
                      type: "fax",
                      value: belarusMobile(2_000_000 + phoneSeed),
                      contactName: "Бухгалтерия",
                      sortOrder: 0,
                    },
                  ],
                },
              },
              {
                fullName: "Менеджер проекта",
                sortOrder: 2,
                channels: {
                  create: [
                    {
                      type: "telegram",
                      value: "@demo_client",
                      contactName: "Менеджер проекта",
                      sortOrder: 0,
                    },
                  ],
                },
              },
              {
                fullName: "Компания",
                role: "Сайт",
                sortOrder: 3,
                channels: {
                  create: [
                    {
                      type: "website",
                      value: "https://demo.by",
                      contactName: "Компания",
                      sortOrder: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
      });
      clientsCount += 1;

      const doc = await prisma.document.create({
        data: {
          clientId: client.id,
          uploaderId: manager.id,
          filename: `demo_${client.id}_contract.pdf`,
          filePath: `/uploads/docs/demo_${client.id}_contract.pdf`,
          fileSize: 4096,
          mimeType: "application/pdf",
        },
      });
      documentsCount += 1;

      const demoProductName = `Демо-товар ${mi + 1}.${ci + 1}`;
      const dealSpecs = [
        { title: "Сделка NEW", stage: "new", amount: 1500, closingDate: addDays(today, 30) },
        { title: "Сделка NEGOTIATION (риск)", stage: "negotiation", amount: 25000, closingDate: closingRisk },
        { title: "Сделка WON", stage: "won", amount: 8000, closingDate: addDays(today, -1) },
      ];

      const dealIds = [];
      for (const spec of dealSpecs) {
        const deal = await prisma.deal.create({
          data: {
            title: spec.title,
            productName: demoProductName,
            description: DEMO_MARKER,
            amount: spec.amount,
            stage: spec.stage,
            closingDate: spec.closingDate,
            clientId: client.id,
            managerId: manager.id,
          },
        });
        dealIds.push(deal.id);
        dealsCount += 1;

        try {
          await prisma.dealDocument.create({
            data: { dealId: deal.id, documentId: doc.id },
          });
        } catch {
          /* deal_documents может отсутствовать до миграции */
        }
      }

      const riskDealId = dealIds[1];
      const taskSpecs = [
        { title: "Просроченная NEW", status: "new", priority: "urgent", dueDate: dueOverdue },
        { title: "Просроченная IN_PROGRESS", status: "in_progress", priority: "high", dueDate: dueOverdue },
        { title: "Задача на сегодня", status: "new", priority: "medium", dueDate: dueToday },
        { title: "Задача на неделю", status: "in_progress", priority: "low", dueDate: dueWeek },
      ];

      for (const ts of taskSpecs) {
        await prisma.task.create({
          data: {
            title: `${ts.title} — ${demoProductName}`,
            description: DEMO_MARKER,
            status: ts.status,
            priority: ts.priority,
            dueDate: ts.dueDate,
            authorId: manager.id,
            clientId: client.id,
            dealId: riskDealId,
          },
        });
        tasksCount += 1;
      }

      await prisma.call.create({
        data: {
          clientId: client.id,
          callerId: manager.id,
          direction: "out",
          status: "completed",
          duration: 120,
          recordingUrl: null,
          startedAt: addDays(today, -1),
          endedAt: addDays(today, -1),
        },
      });
      callsCount += 1;
    }
  }

  console.log(
    `Seed: демо-данные — клиентов ${clientsCount}, сделок ${dealsCount}, задач ${tasksCount}, ` +
      `звонков ${callsCount}, документов ${documentsCount}.`,
  );
}

module.exports = { seedDemoData, DEMO_MARKER };
