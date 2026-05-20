const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Ключ группы: today | yesterday | dayBeforeYesterday | date:YYYY-MM-DD | unknown */
export function getCallDayGroupKey(startedAt) {
  if (!startedAt) {
    return "unknown";
  }
  const callDay = startOfLocalDay(startedAt);
  if (Number.isNaN(callDay.getTime())) {
    return "unknown";
  }
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round((today.getTime() - callDay.getTime()) / DAY_MS);
  if (diffDays === 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "yesterday";
  }
  if (diffDays === 2) {
    return "dayBeforeYesterday";
  }
  return `date:${callDay.toISOString().slice(0, 10)}`;
}

export function getCallDayGroupLabel(groupKey) {
  if (groupKey === "today") {
    return "Сегодня";
  }
  if (groupKey === "yesterday") {
    return "Вчера";
  }
  if (groupKey === "dayBeforeYesterday") {
    return "Позавчера";
  }
  if (groupKey === "unknown") {
    return "Без даты";
  }
  if (String(groupKey).startsWith("date:")) {
    const d = new Date(`${String(groupKey).slice(5)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    }
  }
  return String(groupKey);
}

const GROUP_KEY_ORDER = ["today", "yesterday", "dayBeforeYesterday"];

function compareGroupKeys(a, b) {
  const ai = GROUP_KEY_ORDER.indexOf(a);
  const bi = GROUP_KEY_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) {
    return ai - bi;
  }
  if (ai !== -1) {
    return -1;
  }
  if (bi !== -1) {
    return 1;
  }
  if (a === "unknown") {
    return 1;
  }
  if (b === "unknown") {
    return -1;
  }
  const da = a.startsWith("date:") ? a.slice(5) : "";
  const db = b.startsWith("date:") ? b.slice(5) : "";
  return db.localeCompare(da);
}

/**
 * Группирует звонки по календарным дням (от новых к старым).
 * Внутри группы порядок сохраняется как в отсортированном списке.
 */
export function groupCallsByDay(calls) {
  const buckets = new Map();
  for (const call of calls || []) {
    const key = getCallDayGroupKey(call?.startedAt);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(call);
  }
  return [...buckets.keys()]
    .sort(compareGroupKeys)
    .map((key) => ({
      key,
      label: getCallDayGroupLabel(key),
      items: buckets.get(key) || [],
    }));
}
