const crypto = require("crypto");
const prisma = require("../config/prisma");
const { buildClientInviteUrl } = require("../utils/appBaseUrl");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const generateToken = () => crypto.randomBytes(24).toString("hex");

const assertManagerOwnsClient = async (clientId, managerId) => {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    const err = new Error("Клиент не найден.");
    err.statusCode = 404;
    throw err;
  }
  if (client.managerId !== managerId) {
    const err = new Error("Клиент не найден или недоступен.");
    err.statusCode = 403;
    throw err;
  }
  return client;
};

const createInviteLink = async (clientId, managerId, req = null) => {
  await assertManagerOwnsClient(clientId, managerId);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.clientInviteToken.create({
    data: {
      token,
      clientId,
      managerId,
      expiresAt,
    },
  });
  const path = `/client-invite/${token}`;
  return {
    token,
    url: path,
    absoluteUrl: req ? buildClientInviteUrl(req, token) : path,
    expiresAt: expiresAt.toISOString(),
  };
};

const resolveToken = async (token, req = null) => {
  const row = await prisma.clientInviteToken.findUnique({
    where: { token },
    include: {
      client: { select: { id: true, name: true } },
      manager: { select: { id: true, fullName: true } },
    },
  });
  if (!row) {
    const err = new Error("Ссылка недействительна.");
    err.statusCode = 404;
    throw err;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    const err = new Error("Срок действия ссылки истёк.");
    err.statusCode = 404;
    throw err;
  }
  const canonicalPath = `/client-invite/${row.token}`;
  return {
    clientId: row.clientId,
    managerId: row.managerId,
    clientName: row.client.name,
    clientCompany: row.client.name,
    managerName: row.manager.fullName,
    expiresAt: row.expiresAt.toISOString(),
    canonicalUrl: canonicalPath,
    canonicalAbsoluteUrl: req ? buildClientInviteUrl(req, row.token) : canonicalPath,
  };
};

const resolveTokenForSession = async (token) => {
  const preview = await resolveToken(token);
  return {
    clientId: preview.clientId,
    managerId: preview.managerId,
  };
};

module.exports = {
  createInviteLink,
  resolveToken,
  resolveTokenForSession,
};
