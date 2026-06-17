module.exports = [
  {
    key: "users",
    modelName: "user",
    label: "User",
    requiredFields: ["fullName", "email", "password"],
    managerScopeField: null,
  },
  {
    key: "clients",
    modelName: "client",
    label: "Client",
    requiredFields: ["name"],
    managerScopeField: "managerId",
  },
  {
    key: "deals",
    modelName: "deal",
    label: "Deal",
    requiredFields: ["productName", "title", "clientId"],
    managerScopeField: "managerId",
  },
  {
    key: "tasks",
    modelName: "task",
    label: "Task",
    requiredFields: ["title"],
    managerScopeField: "authorId",
  },
  {
    key: "calls",
    modelName: "call",
    label: "Call",
    requiredFields: ["clientId", "startedAt"],
    managerScopeField: "callerId",
  },
  {
    key: "documents",
    modelName: "document",
    label: "Document",
    requiredFields: ["clientId", "filename"],
    managerScopeField: null,
  },
];
