const prisma = require("../config/prisma");

async function assertUserManagerId(managerId, label = "Менеджер") {
  const id = Number.parseInt(String(managerId), 10);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error(`${label}: укажите корректный ID.`);
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, fullName: true },
  });

  if (!user) {
    const err = new Error(`${label} с ID ${id} не найден. Выберите менеджера из списка.`);
    err.statusCode = 400;
    throw err;
  }

  const role = String(user.role || "").trim().toLowerCase();
  if (role !== "manager" && role !== "admin") {
    const err = new Error(`${label}: пользователь «${user.fullName}» не может быть назначен менеджером клиента.`);
    err.statusCode = 400;
    throw err;
  }

  return id;
}

async function assertClientId(clientId, auth) {
  const id = Number.parseInt(String(clientId), 10);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("Укажите клиента.");
    err.statusCode = 400;
    throw err;
  }

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, managerId: true },
  });

  if (!client) {
    const err = new Error(`Клиент с ID ${id} не найден.`);
    err.statusCode = 400;
    throw err;
  }

  if (auth?.role === "MANAGER" && Number(client.managerId) !== Number(auth.userId)) {
    const err = new Error("Нет доступа к этому клиенту.");
    err.statusCode = 403;
    throw err;
  }

  return id;
}

module.exports = { assertUserManagerId, assertClientId };
