const sanitizeUser = (user) => {
  if (!user) {
    return user;
  }
  const { password: _password, ...rest } = user;
  return rest;
};

module.exports = sanitizeUser;
