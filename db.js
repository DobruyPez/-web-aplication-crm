const { Pool } = require('pg');
require('dotenv').config();

// Пулы подключений для разных ролей
const pools = {
  admin: new Pool({
    connectionString: process.env.DATABASE_URL_ADMIN,
  }),
  manager: new Pool({
    connectionString: process.env.DATABASE_URL_MANAGER,
  }),
};

/**
 * Получить pool для определённой роли
 * @param {'admin' | 'manager'} role
 * @returns {Pool}
 */
function getPool(role) {
  const pool = pools[role];
  if (!pool) {
    throw new Error(`Неизвестная роль: ${role}`);
  }
  return pool;
}

/**
 * Выполнить запрос от имени определённой роли
 * @param {'admin' | 'manager'} role
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<QueryResult>}
 */
async function query(role, text, params) {
  const pool = getPool(role);
  const client = await pool.connect();
  try {
    console.log(`[${role.toUpperCase()}] Выполняю: ${text.substring(0, 100)}...`);
    const result = await client.query(text, params);
    console.log(`[${role.toUpperCase()}] Результат: ${result.rowCount} строк`);
    return result;
  } catch (error) {
    console.error(`[${role.toUpperCase()}] Ошибка:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Проверить подключение всех пулов
 */
async function testConnections() {
  for (const [role, pool] of Object.entries(pools)) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT current_user, current_database()');
      console.log(`✅ Пул "${role}" подключён как "${result.rows[0].current_user}" к БД "${result.rows[0].current_database}"`);
      client.release();
    } catch (error) {
      console.error(`❌ Пул "${role}" не подключился:`, error.message);
    }
  }
}

module.exports = { query, testConnections };