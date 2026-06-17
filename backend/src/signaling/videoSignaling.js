const { WebSocketServer } = require("ws");
const { URL } = require("url");
const prisma = require("../config/prisma");
const videoSessionService = require("../services/videoSessionService");
const { verifyToken } = require("../utils/jwt");

const buildWsAuth = (bearer, session) => {
  if (!bearer) {
    return null;
  }
  try {
    const payload = verifyToken(bearer);
    return {
      role: payload.role === "MANAGER" ? "MANAGER" : "ADMIN",
      userId: Number(payload.userId),
    };
  } catch (_e) {
    return null;
  }
};

const attachVideoSignaling = (httpServer) => {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/video" });

  /** @type {Map<string, Map<string, import('ws').WebSocket>>} */
  const roomSockets = new Map();

  const getRoom = (sessionId) => {
    if (!roomSockets.has(sessionId)) {
      roomSockets.set(sessionId, new Map());
    }
    return roomSockets.get(sessionId);
  };

  const broadcast = (sessionId, payload, exceptPeerId = null) => {
    const room = getRoom(sessionId);
    const text = JSON.stringify(payload);
    for (const [peerId, socket] of room.entries()) {
      if (peerId === exceptPeerId) continue;
      if (socket.readyState === 1) {
        socket.send(text);
      }
    }
  };

  const sendError = (ws, message, code = 400) => {
    ws.send(JSON.stringify({ type: "error", message, code }));
  };

  wss.on("connection", async (ws, req) => {
    let sessionId = null;
    let peerId = null;
    let joinRole = "guest";

    try {
      const url = new URL(req.url || "/", "http://localhost");
      const guestToken = url.searchParams.get("guestToken");
      const authHeader = req.headers["authorization"];
      const tokenFromQuery = url.searchParams.get("access_token");
      const bearer =
        (authHeader && String(authHeader).startsWith("Bearer ") ? authHeader.slice(7) : null) ||
        tokenFromQuery ||
        null;

      if (!guestToken) {
        sendError(ws, "Требуется guestToken.", 400);
        ws.close();
        return;
      }

      const session = await prisma.videoSession.findUnique({ where: { guestToken } });
      if (!session || session.status !== "active") {
        sendError(ws, "Сессия не найдена.", 404);
        ws.close();
        return;
      }

      sessionId = session.id;
      peerId = url.searchParams.get("peerId") || `peer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const room = getRoom(sessionId);
      if (room.size >= videoSessionService.MAX_PARTICIPANTS) {
        sendError(ws, videoSessionService.ROOM_FULL_MESSAGE, 409);
        ws.close();
        return;
      }

      const forceGuest = url.searchParams.get("role") === "guest";
      const wsAuth = forceGuest ? null : buildWsAuth(bearer, session);
      if (bearer && !forceGuest && !wsAuth) {
        sendError(ws, "Неверный токен.", 401);
        ws.close();
        return;
      }

      try {
        const joined = await videoSessionService.joinSession(guestToken, peerId, wsAuth, null, {
          viaWs: true,
        });
        joinRole = joined.role;
      } catch (err) {
        sendError(ws, err.message, err.statusCode || 409);
        ws.close();
        return;
      }

      if (room.size >= videoSessionService.MAX_PARTICIPANTS) {
        sendError(ws, videoSessionService.ROOM_FULL_MESSAGE, 409);
        ws.close();
        return;
      }

      room.set(peerId, ws);

      ws.send(
        JSON.stringify({
          type: "joined",
          sessionId,
          peerId,
          participantCount: videoSessionService.getParticipantCount(sessionId),
          recordingStartedAt: session.recordingStartedAt,
        }),
      );

      broadcast(
        sessionId,
        { type: "peer-joined", peerId, participantCount: videoSessionService.getParticipantCount(sessionId) },
        peerId,
      );

      const existingPeers = [...room.keys()].filter((id) => id !== peerId).slice(0, 1);
      ws.send(JSON.stringify({ type: "peers", peers: existingPeers, joinRole }));
    } catch (error) {
      sendError(ws, error.message || "Ошибка подключения.");
      ws.close();
      return;
    }

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch (_e) {
        return;
      }

      if (!sessionId || !peerId) return;

      const targetPeer = msg.to;
      const room = getRoom(sessionId);

      if (msg.type === "sdp" || msg.type === "ice") {
        if (targetPeer && room.has(targetPeer)) {
          room.get(targetPeer).send(JSON.stringify({ ...msg, from: peerId }));
        } else if (!targetPeer && room.size === 2) {
          const other = [...room.keys()].find((id) => id !== peerId);
          if (other) {
            room.get(other).send(JSON.stringify({ ...msg, from: peerId }));
          }
        }
        return;
      }

      if (msg.type === "leave") {
        ws.close();
      }
    });

    ws.on("close", () => {
      if (!sessionId || !peerId) return;
      const room = getRoom(sessionId);
      room.delete(peerId);
      videoSessionService.leaveSession(sessionId, peerId);
      broadcast(sessionId, {
        type: "peer-left",
        peerId,
        participantCount: videoSessionService.getParticipantCount(sessionId),
      });
      if (room.size === 0) {
        roomSockets.delete(sessionId);
      }
    });
  });

  return wss;
};

module.exports = { attachVideoSignaling };
