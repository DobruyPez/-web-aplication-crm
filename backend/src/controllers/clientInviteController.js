const clientInviteService = require("../services/clientInviteService");
const videoSessionService = require("../services/videoSessionService");

const getPublicInvite = async (req, res, next) => {
  try {
    const preview = await clientInviteService.resolveToken(req.params.token, req);
    res.json(preview);
  } catch (error) {
    next(error);
  }
};

const startVideoFromInvite = async (req, res, next) => {
  try {
    const result = await videoSessionService.findOrCreateActiveSessionForClientInvite(
      req.params.token,
      req,
    );
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
};

const createInviteLink = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== "MANAGER") {
      return res.status(403).json({ message: "Доступно только менеджерам." });
    }
    const clientId = Number(req.params.id);
    const link = await clientInviteService.createInviteLink(clientId, req.auth.userId, req);
    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicInvite,
  startVideoFromInvite,
  createInviteLink,
};
