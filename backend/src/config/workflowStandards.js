const DEAL_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const TASK_STATUSES = ["new", "in_progress", "blocked", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

const DEAL_STAGE_LABELS = {
  new: "Новая",
  qualified: "Квалификация",
  proposal: "Предложение",
  negotiation: "Переговоры",
  won: "Выиграна",
  lost: "Проиграна",
};

const TASK_PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const dealStageLabelsList = () => DEAL_STAGES.map((s) => DEAL_STAGE_LABELS[s] || s).join(", ");
const taskPriorityLabelsList = () => TASK_PRIORITIES.map((p) => TASK_PRIORITY_LABELS[p] || p).join(", ");

const normalizeEnum = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  return String(value).trim().toLowerCase().replace(/\s+/g, "_");
};

module.exports = {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  dealStageLabelsList,
  taskPriorityLabelsList,
  normalizeEnum,
};
