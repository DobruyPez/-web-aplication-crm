const DEAL_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const TASK_STATUSES = ["new", "in_progress", "blocked", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

const normalizeEnum = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  return String(value).trim().toLowerCase().replace(/\s+/g, "_");
};

module.exports = {
  DEAL_STAGES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  normalizeEnum,
};
