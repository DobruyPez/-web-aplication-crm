/** Русские подписи для значений enum в UI (в БД остаются английские коды). */

export const DEAL_STAGE_LABELS = {
  new: "Новая",
  qualified: "Квалификация",
  proposal: "Предложение",
  negotiation: "Переговоры",
  won: "Выиграна",
  lost: "Проиграна",
};

export const TASK_STATUS_LABELS = {
  new: "Новая",
  in_progress: "В работе",
  blocked: "Заблокирована",
  done: "Выполнена",
};

export const TASK_PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export const CALL_DIRECTION_LABELS = {
  out: "Исходящий",
  in: "Входящий",
};

export const CALL_STATUS_LABELS = {
  completed: "Завершён",
  missed: "Пропущен",
  failed: "Не удался",
};

export const USER_ROLE_LABELS = {
  admin: "Администратор",
  manager: "Менеджер",
};

export const LOG_LEVEL_LABELS = {
  info: "Информация",
  warn: "Предупреждение",
  warning: "Предупреждение",
  error: "Ошибка",
  debug: "Отладка",
};

export const ALERT_SEVERITY_LABELS = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
  info: "Информация",
};

const normalizeEnumKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/**
 * @param {string} value
 */
export const getDealStageLabel = (value) => DEAL_STAGE_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getTaskStatusLabel = (value) => TASK_STATUS_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getTaskPriorityLabel = (value) => TASK_PRIORITY_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getCallDirectionLabel = (value) => CALL_DIRECTION_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getCallStatusLabel = (value) => CALL_STATUS_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getUserRoleLabel = (value) => USER_ROLE_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getLogLevelLabel = (value) => LOG_LEVEL_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} value
 */
export const getAlertSeverityLabel = (value) => ALERT_SEVERITY_LABELS[normalizeEnumKey(value)] || normalizeEnumKey(value);

/**
 * @param {string} [resourceKey]
 * @param {string} [fieldName]
 * @param {string} value
 */
export const getEnumOptionLabel = (resourceKey, fieldName, value) => {
  const key = normalizeEnumKey(value);
  if (resourceKey === "deals" && fieldName === "stage") {
    return getDealStageLabel(key);
  }
  if (resourceKey === "tasks" && fieldName === "status") {
    return getTaskStatusLabel(key);
  }
  if (resourceKey === "tasks" && fieldName === "priority") {
    return getTaskPriorityLabel(key);
  }
  if (resourceKey === "calls" && fieldName === "direction") {
    return getCallDirectionLabel(key);
  }
  if (resourceKey === "calls" && fieldName === "status") {
    return getCallStatusLabel(key);
  }
  if (resourceKey === "users" && fieldName === "role") {
    return getUserRoleLabel(key);
  }
  return key.replaceAll("_", " ").replace(/^\w/, (ch) => ch.toUpperCase());
};

/**
 * Универсальная подпись для дашборда и карточек.
 * @param {string} value
 * @param {{ kind?: string }} [opts]
 */
export const formatDisplayLabel = (value, opts = {}) => {
  const key = normalizeEnumKey(value);
  const kind = opts.kind || "";
  if (kind === "deal_stage") return getDealStageLabel(key);
  if (kind === "task_status") return getTaskStatusLabel(key);
  if (kind === "task_priority") return getTaskPriorityLabel(key);
  if (kind === "call_direction") return getCallDirectionLabel(key);
  if (kind === "call_status") return getCallStatusLabel(key);
  if (kind === "user_role") return getUserRoleLabel(key);
  if (kind === "log_level") return getLogLevelLabel(key);
  if (kind === "alert_severity") return getAlertSeverityLabel(key);
  if (DEAL_STAGE_LABELS[key]) return getDealStageLabel(key);
  if (TASK_STATUS_LABELS[key]) return getTaskStatusLabel(key);
  if (TASK_PRIORITY_LABELS[key]) return getTaskPriorityLabel(key);
  if (CALL_DIRECTION_LABELS[key]) return getCallDirectionLabel(key);
  if (CALL_STATUS_LABELS[key]) return getCallStatusLabel(key);
  if (USER_ROLE_LABELS[key]) return getUserRoleLabel(key);
  if (LOG_LEVEL_LABELS[key]) return getLogLevelLabel(key);
  if (ALERT_SEVERITY_LABELS[key]) return getAlertSeverityLabel(key);
  if (key === "system") return "Система";
  return key.replaceAll("_", " ").replace(/^\w/, (ch) => ch.toUpperCase());
};
