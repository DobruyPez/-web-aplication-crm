-- Тестовое наполнение БД (PostgreSQL). Работает под app_admin (DELETE, не TRUNCATE).
-- Администратор: user_1@test.crm.local / 1234 (id = 1).
-- Запуск: cd backend && npm run db:test-data
--
-- Таблица deal_documents: один раз в pgAdmin под postgres выполните
-- backend/prisma/sql/add_deal_documents_postgres.sql

BEGIN;

SET client_min_messages TO WARNING;

DO $cleanup$
BEGIN
  IF to_regclass('public.deal_documents') IS NOT NULL THEN
    EXECUTE 'DELETE FROM deal_documents';
  END IF;
  IF to_regclass('public.video_sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM video_sessions';
  END IF;
  IF to_regclass('public.client_invite_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM client_invite_tokens';
  END IF;
END $cleanup$;

DELETE FROM documents;
DELETE FROM calls;
DELETE FROM tasks;
DELETE FROM deals;
DELETE FROM clients;
DELETE FROM users;

INSERT INTO users (id, full_name, email, password_hash, role, phone, created_at, updated_at)
SELECT
  n,
  CASE WHEN n = 1 THEN 'Администратор' ELSE 'Тестовый пользователь ' || n END,
  'user_' || n || '@test.crm.local',
  '$2b$10$rEg48td0o2ouNhUMaHzW4eYekKalNlJ.8vCjqlzC8B1Yy4Vn7xivK',
  CASE WHEN n = 1 THEN 'admin' ELSE 'manager' END,
  '+37529' || lpad((n % 1000000)::text, 6, '0'),
  now() - n * interval '1 day',
  now()
FROM generate_series(1, 100) AS n;

INSERT INTO clients (id, name, phone, email, address, notes, manager_id, created_at, updated_at)
SELECT
  n,
  'ООО «Компания ' || n || '»',
  '+37517' || lpad((n % 1000000)::text, 6, '0'),
  'client_' || n || '@example.test',
  'г. Минск, ул. Тестовая, д. ' || n,
  'Заметка по клиенту #' || n,
  ((n - 1) % 100) + 1,
  now() - n * interval '1 hour',
  now()
FROM generate_series(1, 500) AS n;

INSERT INTO deals (id, title, product_name, description, amount, stage, closing_date, client_id, manager_id, created_at, updated_at)
SELECT
  n,
  'Сделка №' || n,
  'Товар ' || n,
  'Описание тестовой сделки ' || n,
  ((10000 + (n * 173) % 500000)::numeric(12, 2)),
  (ARRAY['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])[1 + ((n - 1) % 6)],
  (CURRENT_DATE + (n % 120) * interval '1 day')::date,
  ((n - 1) % 500) + 1,
  ((n - 1) % 100) + 1,
  now() - n * interval '1 minute',
  now()
FROM generate_series(1, 500) AS n;

INSERT INTO tasks (id, title, description, status, priority, due_date, author_id, client_id, deal_id, created_at, updated_at)
SELECT
  n,
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

INSERT INTO calls (id, client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at)
SELECT
  n,
  ((n - 1) % 500) + 1,
  ((n - 1) % 100) + 1,
  CASE WHEN n % 2 = 0 THEN 'out' ELSE 'in' END,
  (ARRAY['completed', 'missed', 'busy'])[1 + ((n - 1) % 3)],
  60 + (n % 600),
  'https://example.test/recording/' || n || '.mp3',
  now() - n * interval '1 hour',
  now() - n * interval '1 hour' + (90 + n % 300) * interval '1 second'
FROM generate_series(1, 500) AS n;

INSERT INTO documents (id, client_id, uploader_id, filename, file_path, file_size, mime_type, uploaded_at)
SELECT
  n,
  ((n - 1) % 500) + 1,
  ((n - 1) % 100) + 1,
  'contract_' || n || '.pdf',
  '/storage/test/clients/' || (((n - 1) % 500) + 1) || '/doc_' || n || '.pdf',
  1024 * (100 + (n % 5000)),
  'application/pdf',
  now() - n * interval '1 minute'
FROM generate_series(1, 500) AS n;

DO $links$
BEGIN
  IF to_regclass('public.deal_documents') IS NOT NULL THEN
    INSERT INTO deal_documents (deal_id, document_id)
    SELECT
      d.id,
      doc.id
    FROM deals d
    INNER JOIN documents doc ON doc.client_id = d.client_id
    WHERE doc.id = (
      SELECT MIN(x.id)
      FROM documents x
      WHERE x.client_id = d.client_id
    )
      AND d.id % 3 <> 0;
  END IF;
END $links$;

COMMIT;
