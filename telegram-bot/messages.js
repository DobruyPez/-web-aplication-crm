const toRuDate = (value) => {
  if (!value) return "не указан";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const taskCreatedMessage = ({ actorName, title, dueDate }) =>
  [
    "Новая задача в CRM",
    `От: ${actorName || "система"}`,
    `Название: ${title || "Без названия"}`,
    `Срок: ${toRuDate(dueDate)}`,
  ].join("\n");

const dealCreatedMessage = ({ actorName, title, amount, stage }) =>
  [
    "Новая сделка в CRM",
    `От: ${actorName || "система"}`,
    `Название: ${title || "Без названия"}`,
    `Сумма: ${amount ?? "не указана"}`,
    `Этап: ${stage || "new"}`,
  ].join("\n");

const overdueTaskMessage = ({ title, dueDate }) =>
  ["Просроченная задача", `Название: ${title || "Без названия"}`, `Срок: ${toRuDate(dueDate)}`].join("\n");

module.exports = {
  taskCreatedMessage,
  dealCreatedMessage,
  overdueTaskMessage,
};
