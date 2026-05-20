-- Тестовое наполнение БД (PostgreSQL, схема Prisma CRM).
-- Пользователи: 100. Остальные таблицы: по 500 строк.
-- Пароль всех тестовых пользователей: 1234 (bcrypt, 10 rounds).
--
-- ВНИМАНИЕ: скрипт очищает таблицы documents, calls, tasks, deals, clients, users
-- и сбрасывает последовательности id. Не запускать на продакшене.
--
-- Запуск без установленного psql (из каталога backend, URL из .env):
--   npm run db:test-data
--
-- С psql (если клиент PostgreSQL в PATH):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/seed_test_data.sql
--   PowerShell: psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f tests/seed_test_data.sql
--
-- Через Docker (БД из deploy/docker-compose.yml на localhost:5432):
--   Get-Content ..\tests\seed_test_data.sql | docker compose -f ..\deploy\docker-compose.yml exec -T db psql -U postgres -d crm_course -v ON_ERROR_STOP=1

BEGIN;

SET client_min_messages TO WARNING;

TRUNCATE TABLE
  documents,
  calls,
  tasks,
  deals,
  clients,
  users
RESTART IDENTITY CASCADE;

-- 100 пользователей (первый — admin, остальные — manager)
INSERT INTO users (full_name, email, password_hash, role, phone, created_at, updated_at)
SELECT
  'Тестовый пользователь ' || n,
  'user_' || n || '@test.crm.local',
  '$2b$10$rEg48td0o2ouNhUMaHzW4eYekKalNlJ.8vCjqlzC8B1Yy4Vn7xivK',
  CASE WHEN n = 1 THEN 'admin' ELSE 'manager' END,
  '+37529' || lpad((n % 1000000)::text, 6, '0'),
  now() - n * interval '1 day',
  now()
FROM generate_series(1, 100) AS n;

-- 500 клиентов (manager_id ссылается на users 1..100)
INSERT INTO clients (name, company, phone, email, address, notes, manager_id, created_at, updated_at)
SELECT
  'Клиент ' || n,
  'ООО «Компания ' || n || '»',
  '+37517' || lpad((n % 1000000)::text, 6, '0'),
  'client_' || n || '@example.test',
  'г. Минск, ул. Тестовая, д. ' || n,
  'Заметка по клиенту #' || n,
  ((n - 1) % 100) + 1,
  now() - n * interval '1 hour',
  now()
FROM generate_series(1, 500) AS n;

-- 500 сделок (stage — значения из DEAL_STAGES в приложении)
INSERT INTO deals (title, description, amount, stage, closing_date, client_id, manager_id, created_at, updated_at)
SELECT
  'Сделка №' || n,
  'Описание тестовой сделки ' || n,
  ((10000 + (n * 173) % 500000)::numeric(12, 2)),
  (ARRAY['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])[1 + ((n - 1) % 6)],
  (CURRENT_DATE + (n % 120) * interval '1 day')::date,
  ((n - 1) % 500) + 1,
  ((n - 1) % 100) + 1,
  now() - n * interval '1 minute',
  now()
FROM generate_series(1, 500) AS n;

-- 500 задач (status / priority — из TASK_STATUSES / TASK_PRIORITIES)
INSERT INTO tasks (title, description, status, priority, due_date, author_id, client_id, deal_id, created_at, updated_at)
SELECT
  'Задача ' || n,
  'Описание задачи ' || n,
  (ARRAY['new', 'in_progress', 'blocked', 'done'])[1 + ((n - 1) % 4)],
  (ARRAY['low', 'medium', 'high', 'urgent'])[1 + ((n - 1) % 4)],
  now() + (n % 30) * interval '1 day',
  ((n - 1) % 100) + 1,
  CASE WHEN n % 5 = 0 THEN NULL ELSE ((n - 1) % 500) + 1 END,
  CASE WHEN n % 7 = 0 THEN NULL ELSE ((n - 1) % 500) + 1 END,
  now() - n * interval '1 minute',
  now()
FROM generate_series(1, 500) AS n;

-- 500 звонков
INSERT INTO calls (client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at)
SELECT
  ((n - 1) % 500) + 1,
  ((n - 1) % 100) + 1,
  CASE WHEN n % 2 = 0 THEN 'out' ELSE 'in' END,
  (ARRAY['completed', 'missed', 'busy'])[1 + ((n - 1) % 3)],
  60 + (n % 600),
  'https://example.test/recording/' || n || '.mp3',
  now() - n * interval '1 hour',
  now() - n * interval '1 hour' + (90 + n % 300) * interval '1 second'
FROM generate_series(1, 500) AS n;

-- 500 документов
INSERT INTO documents (client_id, uploader_id, filename, file_path, file_size, mime_type, uploaded_at)
SELECT
  ((n - 1) % 500) + 1,
  ((n - 1) % 100) + 1,
  'contract_' || n || '.pdf',
  '/storage/test/clients/' || (((n - 1) % 500) + 1) || '/doc_' || n || '.pdf',
  1024 * (100 + (n % 5000)),
  'application/pdf',
  now() - n * interval '1 minute'
FROM generate_series(1, 500) AS n;

COMMIT;
