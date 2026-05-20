const express = require('express');
const cors = require('cors');
const { query, testConnections } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// ТЕСТОВЫЕ МАРШРУТЫ
// ============================================================

/**
 * Главная страница с информацией о доступных тестах
 */
app.get('/', (req, res) => {
  res.json({
    message: 'CRM Тестовый Сервер',
    endpoints: [
      'GET  /test-connections          — Проверка подключений к БД',
      '---',
      'GET  /admin/clients             — Админ: все клиенты',
      'POST /admin/clients             — Админ: создать клиента',
      'PUT  /admin/clients/:id         — Админ: обновить клиента',
      'DELETE /admin/clients/:id       — Админ: удалить клиента',
      '---',
      'GET  /admin/users               — Админ: все пользователи',
      'POST /admin/users               — Админ: создать пользователя',
      'DELETE /admin/users/:id         — Админ: удалить пользователя',
      '---',
      'GET  /admin/deals               — Админ: все сделки',
      'GET  /admin/tasks               — Админ: все задачи',
      'GET  /admin/calls               — Админ: все звонки',
      'GET  /admin/documents           — Админ: все документы',
      '---',
      'GET  /manager/:id/clients       — Менеджер: свои клиенты',
      'POST /manager/:id/clients       — Менеджер: создать клиента',
      'PUT  /manager/:id/clients/:cid  — Менеджер: обновить клиента',
      'DELETE /manager/:id/clients/:cid — Менеджер: удалить клиента',
      '---',
      'GET  /manager/:id/deals         — Менеджер: свои сделки',
      'POST /manager/:id/deals         — Менеджер: создать сделку',
      '---',
      'GET  /manager/:id/tasks         — Менеджер: свои задачи',
      'POST /manager/:id/tasks         — Менеджер: создать задачу',
      '---',
      'GET  /manager/:id/calls         — Менеджер: звонки по своим клиентам',
      'POST /manager/:id/calls         — Менеджер: инициировать звонок',
      '---',
      'GET  /manager/:id/documents     — Менеджер: документы своих клиентов',
      'POST /manager/:id/documents     — Менеджер: загрузить документ',
    ]
  });
});

// ============================================================
// 1. ПРОВЕРКА ПОДКЛЮЧЕНИЙ
// ============================================================

app.get('/test-connections', async (req, res) => {
  try {
    await testConnections();
    
    // Дополнительно проверим выполнение запросов под каждой ролью
    const adminResult = await query('admin', 'SELECT current_user, count(*) as user_count FROM users');
    const managerResult = await query('manager', 'SELECT current_user, count(*) as client_count FROM clients');
    
    res.json({
      success: true,
      admin: {
        user: adminResult.rows[0].current_user,
        usersCount: adminResult.rows[0].user_count,
      },
      manager: {
        user: managerResult.rows[0].current_user,
        clientsCount: managerResult.rows[0].client_count,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 2. АДМИНИСТРАТОР — ПОЛНЫЙ ДОСТУП КО ВСЕМ ТАБЛИЦАМ
// ============================================================

// 2.1 Пользователи (users)
app.get('/admin/users', async (req, res) => {
  try {
    const result = await query('admin', 'SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/users', async (req, res) => {
  try {
    const { full_name, email, password_hash, role, phone } = req.body;
    const result = await query(
      'admin',
      'INSERT INTO users (full_name, email, password_hash, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [full_name, email, password_hash, role, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('admin', 'DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ message: 'Пользователь удалён', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2.2 Клиенты (clients)
app.get('/admin/clients', async (req, res) => {
  try {
    const result = await query('admin', `
      SELECT c.*, u.full_name as manager_name 
      FROM clients c 
      JOIN users u ON c.manager_id = u.id 
      ORDER BY c.id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/clients', async (req, res) => {
  try {
    const { name, company, phone, email, address, notes, manager_id } = req.body;
    const result = await query(
      'admin',
      `INSERT INTO clients (name, company, phone, email, address, notes, manager_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, company, phone, email, address, notes, manager_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, phone, email, address, notes, manager_id } = req.body;
    const result = await query(
      'admin',
      `UPDATE clients 
       SET name = $1, company = $2, phone = $3, email = $4, address = $5, notes = $6, manager_id = $7, updated_at = NOW() 
       WHERE id = $8 RETURNING *`,
      [name, company, phone, email, address, notes, manager_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('admin', 'DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    res.json({ message: 'Клиент удалён', client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2.3 Сделки (deals)
app.get('/admin/deals', async (req, res) => {
  try {
    const result = await query('admin', `
      SELECT d.*, c.name as client_name, u.full_name as manager_name 
      FROM deals d 
      JOIN clients c ON d.client_id = c.id 
      JOIN users u ON d.manager_id = u.id 
      ORDER BY d.id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2.4 Задачи (tasks)
app.get('/admin/tasks', async (req, res) => {
  try {
    const result = await query('admin', `
      SELECT t.*, 
             u.full_name as author_name,
             c.name as client_name,
             d.title as deal_title
      FROM tasks t 
      JOIN users u ON t.author_id = u.id 
      LEFT JOIN clients c ON t.client_id = c.id 
      LEFT JOIN deals d ON t.deal_id = d.id 
      ORDER BY t.id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2.5 Звонки (calls)
app.get('/admin/calls', async (req, res) => {
  try {
    const result = await query('admin', `
      SELECT c.*, 
             cl.name as client_name, 
             u.full_name as caller_name 
      FROM calls c 
      JOIN clients cl ON c.client_id = cl.id 
      JOIN users u ON c.caller_id = u.id 
      ORDER BY c.started_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2.6 Документы (documents)
app.get('/admin/documents', async (req, res) => {
  try {
    const result = await query('admin', `
      SELECT d.*, 
             cl.name as client_name, 
             u.full_name as uploader_name 
      FROM documents d 
      JOIN clients cl ON d.client_id = cl.id 
      JOIN users u ON d.uploader_id = u.id 
      ORDER BY d.uploaded_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 3. МЕНЕДЖЕР — ДОСТУП К СВОИМ ДАННЫМ
// 3.1 Клиенты менеджера
// ============================================================

app.get('/manager/:id/clients', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const result = await query(
      'manager',
      'SELECT * FROM clients WHERE manager_id = $1 ORDER BY id',
      [managerId]
    );
    res.json({ manager_id: managerId, clients: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/manager/:id/clients', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const { name, company, phone, email, address, notes } = req.body;
    const result = await query(
      'manager',
      `INSERT INTO clients (name, company, phone, email, address, notes, manager_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, company, phone, email, address, notes, managerId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/manager/:id/clients/:cid', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const clientId = parseInt(req.params.cid);
    const { name, company, phone, email, address, notes } = req.body;
    
    // Проверяем, что клиент принадлежит этому менеджеру
    const checkResult = await query(
      'manager',
      'SELECT id FROM clients WHERE id = $1 AND manager_id = $2',
      [clientId, managerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден или не принадлежит вам' });
    }
    
    const result = await query(
      'manager',
      `UPDATE clients 
       SET name = $1, company = $2, phone = $3, email = $4, address = $5, notes = $6, updated_at = NOW() 
       WHERE id = $7 AND manager_id = $8 RETURNING *`,
      [name, company, phone, email, address, notes, clientId, managerId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/manager/:id/clients/:cid', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const clientId = parseInt(req.params.cid);
    
    const result = await query(
      'manager',
      'DELETE FROM clients WHERE id = $1 AND manager_id = $2 RETURNING *',
      [clientId, managerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден или не принадлежит вам' });
    }
    res.json({ message: 'Клиент удалён', client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.2 Сделки менеджера
app.get('/manager/:id/deals', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const result = await query(
      'manager',
      `SELECT d.*, c.name as client_name 
       FROM deals d 
       JOIN clients c ON d.client_id = c.id 
       WHERE d.manager_id = $1 
       ORDER BY d.id`,
      [managerId]
    );
    res.json({ manager_id: managerId, deals: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/manager/:id/deals', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const { title, description, amount, stage, closing_date, client_id } = req.body;
    
    // Проверяем, что клиент принадлежит этому менеджеру
    const checkResult = await query(
      'manager',
      'SELECT id FROM clients WHERE id = $1 AND manager_id = $2',
      [client_id, managerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(400).json({ error: 'Клиент не найден или не принадлежит вам' });
    }
    
    const result = await query(
      'manager',
      `INSERT INTO deals (title, description, amount, stage, closing_date, client_id, manager_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, amount, stage, closing_date, client_id, managerId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.3 Задачи менеджера
app.get('/manager/:id/tasks', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const result = await query(
      'manager',
      `SELECT t.*, 
              c.name as client_name,
              d.title as deal_title
       FROM tasks t 
       LEFT JOIN clients c ON t.client_id = c.id 
       LEFT JOIN deals d ON t.deal_id = d.id 
       WHERE t.author_id = $1 
       ORDER BY t.id`,
      [managerId]
    );
    res.json({ manager_id: managerId, tasks: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/manager/:id/tasks', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const { title, description, status, priority, due_date, client_id, deal_id } = req.body;
    
    const result = await query(
      'manager',
      `INSERT INTO tasks (title, description, status, priority, due_date, author_id, client_id, deal_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, status || 'new', priority || 'medium', due_date, managerId, client_id, deal_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.4 Звонки менеджера
app.get('/manager/:id/calls', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const result = await query(
      'manager',
      `SELECT c.*, cl.name as client_name 
       FROM calls c 
       JOIN clients cl ON c.client_id = cl.id 
       WHERE c.caller_id = $1 
       ORDER BY c.started_at DESC`,
      [managerId]
    );
    res.json({ manager_id: managerId, calls: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/manager/:id/calls', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const { client_id, direction, status, duration, recording_url, started_at, ended_at } = req.body;
    
    // Проверяем, что клиент принадлежит этому менеджеру
    const checkResult = await query(
      'manager',
      'SELECT id FROM clients WHERE id = $1 AND manager_id = $2',
      [client_id, managerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(400).json({ error: 'Клиент не найден или не принадлежит вам' });
    }
    
    const result = await query(
      'manager',
      `INSERT INTO calls (client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [client_id, managerId, direction, status, duration, recording_url, started_at, ended_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.5 Документы менеджера
app.get('/manager/:id/documents', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const result = await query(
      'manager',
      `SELECT d.*, cl.name as client_name 
       FROM documents d 
       JOIN clients cl ON d.client_id = cl.id 
       WHERE d.uploader_id = $1 
       ORDER BY d.uploaded_at DESC`,
      [managerId]
    );
    res.json({ manager_id: managerId, documents: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/manager/:id/documents', async (req, res) => {
  try {
    const managerId = parseInt(req.params.id);
    const { client_id, filename, file_path, file_size, mime_type } = req.body;
    
    // Проверяем, что клиент принадлежит этому менеджеру
    const checkResult = await query(
      'manager',
      'SELECT id FROM clients WHERE id = $1 AND manager_id = $2',
      [client_id, managerId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(400).json({ error: 'Клиент не найден или не принадлежит вам' });
    }
    
    const result = await query(
      'manager',
      `INSERT INTO documents (client_id, uploader_id, filename, file_path, file_size, mime_type) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [client_id, managerId, filename, file_path, file_size, mime_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ЗАПУСК СЕРВЕРА
// ============================================================

app.listen(PORT, async () => {
  console.log(`🚀 Тестовый сервер CRM запущен на http://localhost:${PORT}`);
  console.log('📋 Проверка подключений к базе данных...');
  await testConnections();
});