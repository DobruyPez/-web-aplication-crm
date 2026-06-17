const rawApiBase = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  rawApiBase !== undefined && rawApiBase !== "" ? rawApiBase : "http://localhost:4000/api";

/** Пустая строка = тот же origin (для VITE_API_BASE_URL вида `/api` за reverse proxy). */
export const API_ORIGIN =
  typeof API_BASE_URL === "string" && API_BASE_URL.startsWith("/")
    ? ""
    : API_BASE_URL.replace(/\/api\/?$/, "") || "http://localhost:4000";

/** Расширения для вкладки «Загрузка документов» (совпадают с backend allowedUploadDocExtensions). */
export const UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docs",
  ".doc",
  ".docx",
  ".docm",
  ".dot",
  ".dotx",
  ".dotm",
  ".rtf",
  ".wps",
  ".wbk",
];
export const UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".webm", ".opus"];

export const DEAL_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
export const TASK_STATUSES = ["new", "in_progress", "blocked", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

/**
 * Поля для «Сортировка по»: только осмысленные для порядка (без паролей, длинного текста, URL).
 * Порядок в массиве — порядок в выпадающем списке. `id` добавляется в UI отдельно.
 */
export const RESOURCE_SORT_FIELDS = {
  users: ["fullName", "email", "role", "phone", "createdAt"],
  clients: ["name", "address", "notes", "managerId", "createdAt"],
  deals: ["productName", "title", "amount", "stage", "closingDate", "clientId", "managerId", "createdAt"],
  tasks: ["title", "status", "priority", "dueDate", "clientId", "dealId", "authorId", "createdAt"],
  calls: ["startedAt", "endedAt", "duration", "status", "direction", "clientId", "callerId"],
  documents: ["filename", "fileSize", "uploadedAt", "clientId", "uploaderId"],
};

export const resources = [
  {
    key: "users",
    label: "Пользователи",
    requiredFields: ["fullName", "email", "password"],
    fields: [
      { name: "fullName", type: "string", required: true },
      { name: "email", type: "string", required: true },
      { name: "password", type: "string", required: true },
      { name: "phone", type: "string", required: false },
      { name: "telegramLink", type: "string", required: false },
      { name: "telegramChatId", type: "string", required: false },
    ],
  },
  {
    key: "clients",
    label: "Клиенты",
    requiredFields: ["name", "managerId"],
    fields: [
      { name: "name", type: "string", required: true },
      { name: "address", type: "string", required: false },
      { name: "notes", type: "string", required: false },
      { name: "managerId", type: "int", required: true },
    ],
  },
  {
    key: "deals",
    label: "Сделки",
    requiredFields: ["productName", "title", "clientId", "managerId"],
    fields: [
      { name: "productName", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: false },
      { name: "amount", type: "decimal", required: false },
      { name: "stage", type: "string", required: false, options: DEAL_STAGES },
      { name: "closingDate", type: "date", required: false },
      { name: "clientId", type: "int", required: true },
      { name: "managerId", type: "int", required: true },
    ],
  },
  {
    key: "tasks",
    label: "Задачи",
    requiredFields: ["title", "authorId"],
    fields: [
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: false },
      { name: "status", type: "string", required: false, options: TASK_STATUSES },
      { name: "priority", type: "string", required: false, options: TASK_PRIORITIES },
      { name: "dueDate", type: "datetime", required: false },
      { name: "authorId", type: "int", required: true },
      { name: "clientId", type: "int", required: false },
      { name: "dealId", type: "int", required: false },
    ],
  },
  {
    key: "calls",
    label: "Звонки",
    requiredFields: ["clientId", "startedAt", "callerId"],
    fields: [
      { name: "clientId", type: "int", required: true },
      { name: "callerId", type: "int", required: true },
      { name: "direction", type: "string", required: false, options: ["out", "in"] },
      { name: "status", type: "string", required: false, options: ["completed", "missed", "failed"] },
      { name: "duration", type: "int", required: false },
      { name: "recordingUrl", type: "string", required: false },
      { name: "startedAt", type: "datetime", required: true },
      { name: "endedAt", type: "datetime", required: false },
    ],
  },
  {
    key: "documents",
    label: "Документы",
    requiredFields: ["clientId", "filename"],
    fields: [
      { name: "clientId", type: "int", required: true },
      { name: "filename", type: "string", required: true },
    ],
  },
];
