const prisma = require("../config/prisma");

const DAY_MS = 24 * 60 * 60 * 1000;

/** Глубокая ссылка на список: recordId, filterField, сортировка (как на главной SPA). */
const dashboardListHref = (path, recordId, filterField = "id") => {
  if (recordId == null || recordId === "") {
    return path;
  }
  const q = new URLSearchParams({
    recordId: String(recordId),
    filterField: String(filterField || "id"),
    sortField: "id",
    sortDirection: "desc",
  });
  return `${path}?${q.toString()}`;
};

const toIsoDayStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toIsoDayEnd = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const asTimestamp = (value) => {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).getTime() : date.getTime();
};

const buildManagerOverview = async (userId) => {
  const now = new Date();
  const todayStart = toIsoDayStart(now);
  const todayEnd = toIsoDayEnd(now);
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);

  const [tasks, deals, calls, documents, clientsCount] = await Promise.all([
    prisma.task.findMany({
      where: { authorId: userId },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      include: { client: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
    }),
    prisma.deal.findMany({
      where: { managerId: userId },
      orderBy: [{ closingDate: "asc" }, { id: "asc" }],
      include: { client: { select: { id: true, name: true, phone: true, email: true } } },
    }),
    prisma.call.findMany({
      where: { client: { managerId: userId } },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        caller: { select: { id: true, fullName: true } },
      },
      take: 20,
    }),
    prisma.document.findMany({
      where: { client: { managerId: userId } },
      orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
      },
      take: 20,
    }),
    prisma.client.count({ where: { managerId: userId } }),
  ]);

  const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now.getTime() && t.status !== "done");
  const todayTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd);
  const weekTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) > todayEnd && new Date(t.dueDate) <= weekEnd);

  const riskyDeals = deals.filter((d) => {
    if (!d.closingDate) return false;
    const closeAt = new Date(d.closingDate);
    return closeAt.getTime() <= weekEnd.getTime() && d.stage !== "won" && d.stage !== "lost";
  });

  const alerts = [
    ...overdueTasks.slice(0, 10).map((task) => ({
      severity: "critical",
      category: "task_overdue",
      title: `Просрочена задача: ${task.title}`,
      actionUrl: dashboardListHref("/tasks", task.id, "id"),
      actionLabel: "Открыть задачи",
    })),
    ...riskyDeals.slice(0, 10).map((deal) => ({
      severity: "warning",
      category: "deal_risk",
      title: `Сделка близка к закрытию: ${deal.title}`,
      actionUrl: dashboardListHref("/deals", deal.id, "id"),
      actionLabel: "Открыть сделки",
    })),
    ...calls
      .filter((c) => c.status === "missed")
      .slice(0, 5)
      .map((call) => ({
        severity: "info",
        category: "missed_call",
        title: `Пропущенный звонок: ${call.client?.name || `ID ${call.clientId}`}`,
        actionUrl: dashboardListHref("/clients", call.clientId, "id"),
        actionLabel: "Открыть клиентов",
      })),
  ];

  return {
    role: "manager",
    metrics: {
      clients: clientsCount,
      tasksTotal: tasks.length,
      tasksOverdue: overdueTasks.length,
      dealsActive: deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
      callsRecent: calls.length,
      docsRecent: documents.length,
    },
    taskBuckets: {
      overdue: overdueTasks.slice(0, 8),
      today: todayTasks.slice(0, 8),
      week: weekTasks.slice(0, 8),
    },
    riskyDeals: riskyDeals.slice(0, 8),
    recentCalls: calls.slice(0, 8),
    recentDocuments: documents.slice(0, 8),
    alerts: alerts.slice(0, 15),
  };
};

const buildAdminOverview = async () => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

  const [users, overdueTasks, riskyDeals, recentCalls, recentDocs, totals] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ role: "manager" }, { role: "MANAGER" }] },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.task.findMany({
      where: { dueDate: { lt: now }, status: { not: "done" } },
      include: { author: { select: { id: true, fullName: true } }, client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      take: 50,
    }),
    prisma.deal.findMany({
      where: {
        closingDate: { lte: weekAhead },
        stage: { notIn: ["won", "lost"] },
      },
      include: { manager: { select: { id: true, fullName: true } }, client: { select: { id: true, name: true } } },
      orderBy: [{ closingDate: "asc" }, { id: "asc" }],
      take: 50,
    }),
    prisma.call.findMany({
      where: { startedAt: { gte: weekAgo } },
      include: { caller: { select: { id: true, fullName: true } }, client: { select: { id: true, name: true } } },
      orderBy: [{ startedAt: "desc" }],
      take: 50,
    }),
    prisma.document.findMany({
      where: { uploadedAt: { gte: weekAgo } },
      include: { uploader: { select: { id: true, fullName: true } }, client: { select: { id: true, name: true } } },
      orderBy: [{ uploadedAt: "desc" }],
      take: 50,
    }),
    Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.deal.count(),
      prisma.task.count(),
      prisma.call.count(),
      prisma.document.count(),
    ]),
  ]);

  const managerHealth = users.map((manager) => {
    const managerOverdue = overdueTasks.filter((t) => t.author?.id === manager.id).length;
    const managerDealsRisk = riskyDeals.filter((d) => d.manager?.id === manager.id).length;
    const managerCalls7d = recentCalls.filter((c) => c.caller?.id === manager.id).length;
    return {
      managerId: manager.id,
      managerName: manager.fullName,
      managerEmail: manager.email,
      overdueTasks: managerOverdue,
      riskyDeals: managerDealsRisk,
      calls7d: managerCalls7d,
    };
  });

  const alerts = [
    ...overdueTasks.slice(0, 10).map((t) => ({
      severity: "critical",
      category: "task_overdue",
      title: `Просрочка: ${t.title} (${t.author?.fullName || "без автора"})`,
      actionUrl: dashboardListHref("/tasks", t.id, "id"),
      actionLabel: "Открыть задачи",
    })),
    ...riskyDeals.slice(0, 10).map((d) => ({
      severity: "warning",
      category: "deal_risk",
      title: `Риск сделки: ${d.title} (${d.manager?.fullName || "без менеджера"})`,
      actionUrl: dashboardListHref("/deals", d.id, "id"),
      actionLabel: "Открыть сделки",
    })),
  ];

  const serverLogs = [
    ...overdueTasks.slice(0, 12).map((task) => ({
      id: `task-overdue-${task.id}`,
      level: "critical",
      source: "tasks",
      message: `Просрочена задача «${task.title}» (${task.author?.fullName || "без автора"})`,
      createdAt: task.dueDate || now,
      actionUrl: dashboardListHref("/tasks", task.id, "id"),
      actionLabel: "Открыть задачи",
    })),
    ...riskyDeals.slice(0, 12).map((deal) => ({
      id: `deal-risk-${deal.id}`,
      level: "warning",
      source: "deals",
      message: `Рисковая сделка «${deal.title}» (${deal.manager?.fullName || "без менеджера"})`,
      createdAt: deal.closingDate || now,
      actionUrl: dashboardListHref("/deals", deal.id, "id"),
      actionLabel: "Открыть сделки",
    })),
    ...recentCalls
      .filter((call) => String(call.status || "").toLowerCase() === "missed")
      .slice(0, 8)
      .map((call) => ({
        id: `call-missed-${call.id}`,
        level: "warning",
        source: "calls",
        message: `Пропущенный звонок по клиенту «${call.client?.name || `ID ${call.clientId}`}»`,
        createdAt: call.startedAt || now,
        actionUrl: dashboardListHref("/clients", call.clientId, "id"),
        actionLabel: "Открыть клиентов",
      })),
    ...recentDocs.slice(0, 8).map((doc) => ({
      id: `doc-upload-${doc.id}`,
      level: "info",
      source: "documents",
      message: `Загружен документ «${doc.filename}» (${doc.uploader?.fullName || "неизвестный пользователь"})`,
      createdAt: doc.uploadedAt || now,
      actionUrl: dashboardListHref("/documents", doc.id, "id"),
      actionLabel: "Открыть документы",
    })),
  ]
    .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
    .slice(0, 20);

  return {
    role: "admin",
    metrics: {
      users: totals[0],
      clients: totals[1],
      deals: totals[2],
      tasks: totals[3],
      calls: totals[4],
      documents: totals[5],
      overdueTasks: overdueTasks.length,
      riskyDeals: riskyDeals.length,
    },
    managerHealth: managerHealth.sort((a, b) => b.overdueTasks - a.overdueTasks).slice(0, 20),
    overdueTasks: overdueTasks.slice(0, 10),
    riskyDeals: riskyDeals.slice(0, 10),
    recentCalls: recentCalls.slice(0, 10),
    recentDocuments: recentDocs.slice(0, 10),
    serverLogs,
    alerts: alerts.slice(0, 20),
  };
};

const dashboardOverview = async (req, res, next) => {
  try {
    if (req.auth.role === "ADMIN") {
      return res.json(await buildAdminOverview());
    }
    return res.json(await buildManagerOverview(req.auth.userId));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  dashboardOverview,
};
