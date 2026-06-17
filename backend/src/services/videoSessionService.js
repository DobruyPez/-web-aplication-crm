const crypto = require("crypto");
const prisma = require("../config/prisma");
const { parseClientInviteToken } = require("../utils/clientContextToken");
const { buildJoinUrl } = require("../utils/appBaseUrl");
const clientInviteService = require("./clientInviteService");
const CallsService = require("./callsService");
const BaseRepository = require("../repositories/baseRepository");
const resources = require("../config/resources");

/** Двухсторонний звонок: только менеджер-хост + один клиент-гость. */
const MAX_PARTICIPANTS = 2;
const ROOM_FULL_MESSAGE = "Менеджер уже на линии с клиентом. Дождитесь окончания звонка.";

const MSG_ADMIN_FORBIDDEN = "Администратор не может входить в двухсторонний звонок.";
const MSG_OTHER_MANAGER = "В звонке только ответственный менеджер и клиент.";
const MSG_HOST_VIA_JOIN = "Откройте комнату хоста в CRM (/calls/video-host/…), а не ссылку join.";

/** @type {Map<string, { hostPeerId: string|null, clientPeerId: string|null }>} */
const sessionSlots = new Map();

const callsResource = resources.find((r) => r.key === "calls");
const callsRepository = new BaseRepository(prisma, callsResource.modelName);
const callsService = new CallsService(callsRepository, callsResource);

const generateGuestToken = () => crypto.randomBytes(24).toString("hex");

const getSlots = (sessionId) => {
  if (!sessionSlots.has(sessionId)) {
    sessionSlots.set(sessionId, { hostPeerId: null, clientPeerId: null });
  }
  return sessionSlots.get(sessionId);
};

const getParticipantCount = (sessionId) => {
  const s = getSlots(sessionId);
  return (s.hostPeerId ? 1 : 0) + (s.clientPeerId ? 1 : 0);
};

const clearSessionPeers = (sessionId) => {
  sessionSlots.delete(sessionId);
};

const removeParticipant = (sessionId, peerId) => {
  const slots = getSlots(sessionId);
  if (slots.hostPeerId === peerId) {
    slots.hostPeerId = null;
  }
  if (slots.clientPeerId === peerId) {
    slots.clientPeerId = null;
  }
  return getParticipantCount(sessionId);
};

const formatSession = (row, req = null) => {
  const guestJoinPath = `/calls/join/${row.guestToken}`;
  const guestJoinUrl = req ? buildJoinUrl(req, row.guestToken) : guestJoinPath;
  return {
    id: row.id,
    managerId: row.managerId,
    clientId: row.clientId,
    direction: row.direction,
    guestToken: row.guestToken,
    guestJoinUrl,
    guestJoinPath,
    status: row.status,
    recordingStartedAt: row.recordingStartedAt,
    recordingUrl: row.recordingUrl,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    participantCount: getParticipantCount(row.id),
    maxParticipants: MAX_PARTICIPANTS,
  };
};

const resolveClientForCreate = async (payload, managerId) => {
  const inviteRaw = payload.clientInviteUrl || payload.clientInviteLink || payload.inviteUrl;
  const inviteToken = payload.clientInviteToken || parseClientInviteToken(inviteRaw);

  if (inviteToken) {
    const resolved = await clientInviteService.resolveTokenForSession(inviteToken);
    if (resolved.managerId !== managerId) {
      const err = new Error("Ссылка клиента принадлежит другому менеджеру.");
      err.statusCode = 403;
      throw err;
    }
    return { clientId: resolved.clientId, direction: "in" };
  }

  const clientId = Number(payload.clientId);
  if (!Number.isInteger(clientId) || clientId < 1) {
    const err = new Error("Укажите clientId или ссылку от клиента.");
    err.statusCode = 400;
    throw err;
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.managerId !== managerId) {
    const err = new Error("Клиент не найден или недоступен.");
    err.statusCode = 403;
    throw err;
  }

  return { clientId, direction: "out" };
};

const createSessionInternal = async (managerId, clientId, direction, req) => {
  const guestToken = generateGuestToken();
  const row = await prisma.videoSession.create({
    data: {
      managerId,
      clientId,
      direction,
      guestToken,
      status: "active",
    },
    include: {
      client: { select: { id: true, name: true } },
      manager: { select: { id: true, fullName: true } },
    },
  });
  getSlots(row.id);
  const formatted = formatSession(row, req);
  return {
    sessionId: row.id,
    ...formatted,
    joinUrl: formatted.guestJoinUrl,
    clientName: row.client.name,
    managerName: row.manager.fullName,
    created: true,
  };
};

const createSession = async (payload, auth, req) => {
  if (auth.role !== "MANAGER") {
    const err = new Error("Видеоконференции доступны только менеджерам.");
    err.statusCode = 403;
    throw err;
  }

  const { clientId, direction } = await resolveClientForCreate(payload, auth.userId);
  const result = await createSessionInternal(auth.userId, clientId, direction, req);
  return { ...result, created: true };
};

const findOrCreateActiveSessionForClientInvite = async (inviteToken, req) => {
  const preview = await clientInviteService.resolveToken(inviteToken, req);
  const existing = await prisma.videoSession.findFirst({
    where: {
      managerId: preview.managerId,
      clientId: preview.clientId,
      status: "active",
      direction: "in",
    },
    orderBy: { startedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      manager: { select: { id: true, fullName: true } },
    },
  });

  if (existing) {
    const formatted = formatSession(existing, req);
    return {
      sessionId: existing.id,
      guestToken: existing.guestToken,
      joinUrl: formatted.guestJoinUrl,
      clientName: existing.client.name,
      managerName: existing.manager.fullName,
      created: false,
      maxParticipants: MAX_PARTICIPANTS,
    };
  }

  return createSessionInternal(preview.managerId, preview.clientId, "in", req);
};

const getPublicHint = async (sessionId, req) => {
  const row = await prisma.videoSession.findUnique({
    where: { id: sessionId },
    include: { client: { select: { name: true } } },
  });
  if (!row) {
    const err = new Error("Сессия не найдена.");
    err.statusCode = 404;
    throw err;
  }
  if (row.status !== "active") {
    return {
      sessionId: row.id,
      status: row.status,
      message: "Сессия завершена. Попросите менеджера начать новую конференцию.",
      joinUrl: null,
      maxParticipants: MAX_PARTICIPANTS,
    };
  }
  return {
    sessionId: row.id,
    status: row.status,
    clientName: row.client?.name,
    message:
      "Это ссылка для менеджера-хоста. Клиенту отправьте ссылку конференции /calls/join/…",
    joinUrl: buildJoinUrl(req, row.guestToken),
    guestToken: row.guestToken,
    maxParticipants: MAX_PARTICIPANTS,
  };
};

const getSession = async (sessionId, auth) => {
  const row = await prisma.videoSession.findUnique({
    where: { id: sessionId },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!row) {
    const err = new Error("Сессия не найдена.");
    err.statusCode = 404;
    throw err;
  }

  if (auth?.role === "MANAGER" && row.managerId !== auth.userId) {
    const err = new Error("Сессия не найдена.");
    err.statusCode = 404;
    throw err;
  }

  return {
    ...formatSession(row),
    clientName: row.client?.name,
  };
};

const getJoinMeta = async (guestToken) => {
  const row = await prisma.videoSession.findUnique({
    where: { guestToken },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!row || row.status !== "active") {
    const err = new Error("Сессия не найдена или завершена.");
    err.statusCode = 404;
    throw err;
  }
  return {
    sessionId: row.id,
    clientName: row.client.name,
    status: row.status,
    participantCount: getParticipantCount(row.id),
    maxParticipants: MAX_PARTICIPANTS,
    recordingStartedAt: row.recordingStartedAt,
  };
};

/**
 * @param {object} options
 * @param {boolean} options.viaWs — WebSocket: хост (JWT менеджера) или гость (без JWT)
 */
const joinSession = async (guestToken, peerId, auth, req = null, options = { viaWs: false }) => {
  const row = await prisma.videoSession.findUnique({ where: { guestToken } });
  if (!row || row.status !== "active") {
    const err = new Error("Сессия не найдена или завершена.");
    err.statusCode = 404;
    throw err;
  }

  const slots = getSlots(row.id);
  const actualPeerId = peerId || `peer-${crypto.randomBytes(8).toString("hex")}`;

  if (auth?.role === "ADMIN") {
    const err = new Error(MSG_ADMIN_FORBIDDEN);
    err.statusCode = 403;
    throw err;
  }

  const isSessionManager =
    auth?.role === "MANAGER" && Number(auth.userId) === Number(row.managerId);

  if (options.viaWs) {
    if (isSessionManager) {
      slots.hostPeerId = actualPeerId;
      return finishJoin(row, actualPeerId, "host", req);
    }
    if (!auth) {
      if (slots.clientPeerId && slots.clientPeerId !== actualPeerId) {
        const err = new Error(ROOM_FULL_MESSAGE);
        err.statusCode = 409;
        throw err;
      }
      slots.clientPeerId = actualPeerId;
      return finishJoin(row, actualPeerId, "client", req);
    }
    const err = new Error(MSG_OTHER_MANAGER);
    err.statusCode = 403;
    throw err;
  }

  if (isSessionManager) {
    const err = new Error(MSG_HOST_VIA_JOIN);
    err.statusCode = 400;
    throw err;
  }

  if (auth?.role === "MANAGER") {
    const err = new Error(MSG_OTHER_MANAGER);
    err.statusCode = 403;
    throw err;
  }

  if (slots.clientPeerId && slots.clientPeerId !== actualPeerId) {
    const err = new Error(ROOM_FULL_MESSAGE);
    err.statusCode = 409;
    throw err;
  }

  slots.clientPeerId = actualPeerId;
  return finishJoin(row, actualPeerId, "client", req);
};

const finishJoin = async (row, peerId, role, req) => {
  let recordingStartedAt = row.recordingStartedAt;
  const count = getParticipantCount(row.id);
  if (count >= MAX_PARTICIPANTS && !recordingStartedAt) {
    recordingStartedAt = new Date();
    await prisma.videoSession.update({
      where: { id: row.id },
      data: { recordingStartedAt },
    });
  }

  return {
    sessionId: row.id,
    participantCount: count,
    maxParticipants: MAX_PARTICIPANTS,
    recordingStartedAt,
    role,
    joinUrl: req ? buildJoinUrl(req, row.guestToken) : `/calls/join/${row.guestToken}`,
  };
};

const leaveSession = (sessionId, peerId) => {
  if (!sessionId || !peerId) {
    return;
  }
  removeParticipant(sessionId, peerId);
};

const saveRecording = async (sessionId, recordingUrl, auth) => {
  const row = await prisma.videoSession.findUnique({ where: { id: sessionId } });
  if (!row) {
    const err = new Error("Сессия не найдена.");
    err.statusCode = 404;
    throw err;
  }
  if (auth.role !== "MANAGER" || row.managerId !== auth.userId) {
    const err = new Error("Нет доступа к этой сессии.");
    err.statusCode = 403;
    throw err;
  }
  if (row.status !== "active") {
    const err = new Error("Сессия уже завершена.");
    err.statusCode = 400;
    throw err;
  }

  const updated = await prisma.videoSession.update({
    where: { id: sessionId },
    data: { recordingUrl },
  });
  return formatSession(updated);
};

const endSession = async (sessionId, auth) => {
  const row = await prisma.videoSession.findUnique({
    where: { id: sessionId },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!row) {
    const err = new Error("Сессия не найдена.");
    err.statusCode = 404;
    throw err;
  }
  if (auth.role !== "MANAGER" || row.managerId !== auth.userId) {
    const err = new Error("Завершить сессию может только её менеджер.");
    err.statusCode = 403;
    throw err;
  }
  if (row.status === "ended") {
    return { session: formatSession(row), call: null };
  }

  const endedAt = new Date();
  const startedAt = row.recordingStartedAt || row.startedAt;
  const duration = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  const updated = await prisma.videoSession.update({
    where: { id: sessionId },
    data: { status: "ended", endedAt },
  });

  clearSessionPeers(sessionId);

  let call = null;
  if (row.recordingUrl) {
    call = await callsService.createFromVideoSession(
      {
        clientId: row.clientId,
        callerId: row.managerId,
        direction: row.direction,
        duration,
        recordingUrl: row.recordingUrl,
        startedAt,
        endedAt,
        status: "completed",
      },
      { role: "MANAGER", userId: row.managerId },
    );
  }

  return { session: formatSession(updated), call };
};

/** @deprecated используйте removeParticipant */
const addParticipant = (sessionId, peerId) => {
  const slots = getSlots(sessionId);
  if (!slots.hostPeerId) {
    slots.hostPeerId = peerId;
    return { count: getParticipantCount(sessionId), added: true };
  }
  if (!slots.clientPeerId) {
    slots.clientPeerId = peerId;
    return { count: getParticipantCount(sessionId), added: true };
  }
  const err = new Error(ROOM_FULL_MESSAGE);
  err.statusCode = 409;
  throw err;
};

module.exports = {
  MAX_PARTICIPANTS,
  ROOM_FULL_MESSAGE,
  MSG_ADMIN_FORBIDDEN,
  MSG_OTHER_MANAGER,
  MSG_HOST_VIA_JOIN,
  createSession,
  createSessionInternal,
  findOrCreateActiveSessionForClientInvite,
  getPublicHint,
  getSession,
  getJoinMeta,
  joinSession,
  leaveSession,
  saveRecording,
  endSession,
  addParticipant,
  removeParticipant,
  getParticipantCount,
  formatSession,
};
