import { resources } from "./config";

/** Поля и обязательность с учётом роли (менеджер — скрытые FK задаются через defaults в форме). */
export const getResourceForUi = (key, role) => {
  const base = resources.find((r) => r.key === key);
  if (!base) {
    return null;
  }
  const clone = structuredClone(base);

  if (role?.toLowerCase() !== "admin") {
    const hide = [];
    if (key === "clients") hide.push("managerId");
    if (key === "deals") hide.push("managerId");
    if (key === "tasks") hide.push("authorId");
    if (key === "calls") hide.push("callerId");
    if (key === "documents") hide.push("uploaderId");

    clone.fields = clone.fields.filter((f) => !hide.includes(f.name));

    if (key === "clients") clone.requiredFields = ["name"];
    if (key === "deals") clone.requiredFields = ["productName", "title", "clientId"];
    if (key === "tasks") clone.requiredFields = ["title"];
    if (key === "calls") clone.requiredFields = ["clientId", "startedAt"];
    if (key === "documents") clone.requiredFields = ["clientId", "filename"];
  }

  if (key === "documents") {
    clone.fields = clone.fields.filter(
      (f) => !["filePath", "fileSize", "mimeType", "uploaderId"].includes(f.name),
    );
    clone.requiredFields = ["clientId", "filename"];
  }

  return clone;
};
