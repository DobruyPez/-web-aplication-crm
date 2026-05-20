const prisma = require("../config/prisma");
const { sendTelegramMessage, isBotEnabled } = require("../../../telegram-bot/botClient");
const { taskCreatedMessage, dealCreatedMessage, overdueTaskMessage } = require("../../../telegram-bot/messages");

const getActorName = async (userId) => {
  if (!userId) return "Система";
  const user = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { fullName: true } });
  return user?.fullName || "Система";
};

const notifyUser = async (userId, text) => {
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H1_H2',location:'telegramNotificationService.js:notifyUser:start',message:'notifyUser called',data:{userId: userId || null, hasText: Boolean(text), botEnabled: isBotEnabled()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!isBotEnabled() || !userId || !text) {
    // #region agent log
    fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H1_H3',location:'telegramNotificationService.js:notifyUser:skip-guard',message:'notifyUser skipped by guard',data:{userId: userId || null, hasText: Boolean(text), botEnabled: isBotEnabled()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return;
  }
  const recipient = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { telegramChatId: true },
  });
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H2',location:'telegramNotificationService.js:notifyUser:recipient',message:'recipient telegram data loaded',data:{userId: userId || null, hasChatId: Boolean(recipient?.telegramChatId)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!recipient?.telegramChatId) {
    return;
  }
  await sendTelegramMessage({ chatId: recipient.telegramChatId, text });
};

const notifyTaskCreated = async ({ actorId, assigneeId, task }) => {
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H3',location:'telegramNotificationService.js:notifyTaskCreated',message:'task notification requested',data:{actorId: actorId || null, assigneeId: assigneeId || null, taskId: task?.id || null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const actorName = await getActorName(actorId);
  await notifyUser(
    assigneeId,
    taskCreatedMessage({
      actorName,
      title: task?.title,
      dueDate: task?.dueDate,
    }),
  );
};

const notifyDealCreated = async ({ actorId, managerId, deal }) => {
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H3',location:'telegramNotificationService.js:notifyDealCreated',message:'deal notification requested',data:{actorId: actorId || null, managerId: managerId || null, dealId: deal?.id || null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const actorName = await getActorName(actorId);
  await notifyUser(
    managerId,
    dealCreatedMessage({
      actorName,
      title: deal?.title,
      amount: deal?.amount,
      stage: deal?.stage,
    }),
  );
};

const notifyOverdueTask = async ({ assigneeId, task }) => {
  const dueDate = task?.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
  const isDone = String(task?.status || "").toLowerCase() === "done";
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H5',location:'telegramNotificationService.js:notifyOverdueTask:evaluation',message:'overdue evaluation',data:{assigneeId: assigneeId || null, taskId: task?.id || null, isOverdue: Boolean(isOverdue), isDone},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!isOverdue || isDone) {
    return;
  }
  await notifyUser(
    assigneeId,
    overdueTaskMessage({
      title: task?.title,
      dueDate: task?.dueDate,
    }),
  );
};

module.exports = {
  notifyTaskCreated,
  notifyDealCreated,
  notifyOverdueTask,
};
