const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDayEnd(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Совпадает с правилами корзин задач на дашборде (dashboardController buildManagerOverview).
 */
export function taskMatchesDashboardBucket(task, bucket, now = new Date()) {
  if (!bucket || !["overdue", "today", "week"].includes(bucket)) {
    return true;
  }
  const dueRaw = task?.dueDate;
  if (!dueRaw) {
    return false;
  }
  const due = new Date(dueRaw);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const status = String(task?.status || "");
  const todayStart = toIsoDayStart(now);
  const todayEnd = toIsoDayEnd(now);
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);

  if (bucket === "overdue") {
    return due.getTime() < now.getTime() && status !== "done";
  }
  if (bucket === "today") {
    return due >= todayStart && due <= todayEnd;
  }
  if (bucket === "week") {
    return due > todayEnd && due <= weekEnd;
  }
  return false;
}

/**
 * «Сделка в риске» как на дашборде: дата закрытия в ближайшие 7 дней, этап не won/lost.
 */
export function dealMatchesDashboardRisk(deal, now = new Date()) {
  const closingRaw = deal?.closingDate;
  if (!closingRaw) {
    return false;
  }
  const closeAt = new Date(closingRaw);
  if (Number.isNaN(closeAt.getTime())) {
    return false;
  }
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);
  const stage = String(deal?.stage || "").toLowerCase();
  return closeAt.getTime() <= weekEnd.getTime() && stage !== "won" && stage !== "lost";
}
