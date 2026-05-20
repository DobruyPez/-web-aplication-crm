-- Единый стандарт данных:
-- deals.stage: new | qualified | proposal | negotiation | won | lost
-- tasks.status: new | in_progress | blocked | done
-- tasks.priority: low | medium | high | urgent
-- Заполняются все таблицы, кроме users.

BEGIN;

-- При необходимости очистите таблицы перед вставкой:
-- TRUNCATE TABLE documents, calls, tasks, deals, clients RESTART IDENTITY CASCADE;

WITH manager_pool AS (
  SELECT id
  FROM users
  WHERE LOWER(role) IN ('manager', 'admin')
  ORDER BY id
),
manager_ids AS (
  SELECT
    (SELECT id FROM manager_pool OFFSET 0 LIMIT 1) AS manager_1,
    COALESCE((SELECT id FROM manager_pool OFFSET 1 LIMIT 1), (SELECT id FROM manager_pool OFFSET 0 LIMIT 1)) AS manager_2
),
ins_clients AS (
  INSERT INTO clients (name, company, phone, email, address, notes, manager_id, created_at, updated_at)
  SELECT * FROM (
    SELECT 'Иван Петров', 'North Logistic', '+7-900-100-00-01', 'petrov@northlog.ru', 'Москва, ул. Тверская, 10', 'Ключевой клиент B2B', manager_1, now(), now() FROM manager_ids
    UNION ALL
    SELECT 'Анна Смирнова', 'Sky Retail', '+7-900-100-00-02', 'smirnova@skyretail.ru', 'Санкт-Петербург, Невский пр., 28', 'Нужны ежемесячные отчеты', manager_2, now(), now() FROM manager_ids
    UNION ALL
    SELECT 'Олег Волков', 'Delta Tech', '+7-900-100-00-03', 'volkov@deltatech.ru', 'Казань, ул. Баумана, 5', 'Интерес к расширенному пакету', manager_1, now(), now() FROM manager_ids
  ) s
  RETURNING id, manager_id, name
),
ins_deals AS (
  INSERT INTO deals (title, description, amount, stage, closing_date, client_id, manager_id, created_at, updated_at)
  SELECT
    CONCAT('Контракт: ', c.name),
    'Сделка создана в едином стандарте CRM.',
    CASE ROW_NUMBER() OVER (ORDER BY c.id)
      WHEN 1 THEN 250000
      WHEN 2 THEN 410000
      ELSE 180000
    END,
    CASE ROW_NUMBER() OVER (ORDER BY c.id)
      WHEN 1 THEN 'qualified'
      WHEN 2 THEN 'proposal'
      ELSE 'negotiation'
    END,
    (current_date + ((ROW_NUMBER() OVER (ORDER BY c.id) * 10)::int)),
    c.id,
    c.manager_id,
    now(),
    now()
  FROM ins_clients c
  RETURNING id, client_id, manager_id
),
ins_tasks AS (
  INSERT INTO tasks (title, description, status, priority, due_date, author_id, client_id, deal_id, created_at, updated_at)
  SELECT
    CONCAT('Подготовить КП по сделке #', d.id),
    'Задача создана в едином стандарте CRM.',
    CASE ROW_NUMBER() OVER (ORDER BY d.id)
      WHEN 1 THEN 'new'
      WHEN 2 THEN 'in_progress'
      ELSE 'blocked'
    END,
    CASE ROW_NUMBER() OVER (ORDER BY d.id)
      WHEN 1 THEN 'medium'
      WHEN 2 THEN 'high'
      ELSE 'urgent'
    END,
    now() + (ROW_NUMBER() OVER (ORDER BY d.id) || ' days')::interval,
    d.manager_id,
    d.client_id,
    d.id,
    now(),
    now()
  FROM ins_deals d
  RETURNING id, client_id, author_id
),
ins_calls AS (
  INSERT INTO calls (client_id, caller_id, direction, status, duration, recording_url, started_at, ended_at)
  SELECT
    t.client_id,
    t.author_id,
    'out',
    CASE ROW_NUMBER() OVER (ORDER BY t.id)
      WHEN 1 THEN 'completed'
      WHEN 2 THEN 'missed'
      ELSE 'completed'
    END,
    CASE ROW_NUMBER() OVER (ORDER BY t.id)
      WHEN 1 THEN 240
      WHEN 2 THEN 0
      ELSE 180
    END,
    NULL,
    now() - (ROW_NUMBER() OVER (ORDER BY t.id) || ' hours')::interval,
    now() - (ROW_NUMBER() OVER (ORDER BY t.id) || ' hours')::interval + interval '5 minutes'
  FROM ins_tasks t
  RETURNING id, client_id, caller_id
)
INSERT INTO documents (client_id, uploader_id, filename, file_path, file_size, mime_type, uploaded_at)
SELECT
  c.client_id,
  c.caller_id,
  CONCAT('commercial_offer_', c.id, '.pdf'),
  CONCAT('/docs/commercial_offer_', c.id, '.pdf'),
  102400 + (c.id * 2000),
  'application/pdf',
  now()
FROM ins_calls c;

COMMIT;
