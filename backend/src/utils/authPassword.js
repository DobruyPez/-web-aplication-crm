const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

const hashPassword = (plain) => bcrypt.hashSync(plain, SALT_ROUNDS);

const comparePassword = (plain, hash) => bcrypt.compareSync(plain, hash);

module.exports = {
  hashPassword,
  comparePassword,
};
