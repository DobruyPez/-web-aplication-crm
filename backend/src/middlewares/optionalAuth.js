/**
 * Публичный join: только клиент-гость без JWT.
 * JWT на join отклоняется в videoSessionService.joinSession (HTTP).
 */
const optionalAuth = (req, _res, next) => {
  req.joinRole = "guest";
  next();
};

module.exports = optionalAuth;
