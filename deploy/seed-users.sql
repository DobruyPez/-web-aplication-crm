-- Тестовые пользователи для CRM в Docker (PostgreSQL).
-- Пароль для всех: 1234 (bcrypt, 10 rounds — как в backend/src/utils/authPassword.js)
--
-- ФИО заданы через U&'...' (коды Unicode), чтобы при вставке через PowerShell не ломалась кириллица:
-- без -Encoding UTF8 команда Get-Content читает файл в системной кодировке, и в БД попадают «????».
--
-- Применение из корня репозитория (PowerShell, надёжно):
--   Get-Content -Encoding UTF8 deploy/seed-users.sql | docker compose -f deploy/docker-compose.yml exec -T db psql -U postgres -d crm_course
--
-- Linux/macOS:
--   docker compose -f deploy/docker-compose.yml exec -T db psql -U postgres -d crm_course < deploy/seed-users.sql

INSERT INTO users (full_name, email, password_hash, role, phone, telegram_link, telegram_chat_id)
VALUES
  (U&'\0410\0434\043c\0438\043d\0438\0441\0442\0440\0430\0442\043e\0440', 'admin@crm.by', '$2b$10$zAyUnNz1ykutKrAYnS/ZC.PxQ8UfwbE8fIcH6G7LzXTFvGYZvtski', 'admin', NULL, NULL, NULL),
  (U&'\041c\0435\043d\0435\0434\0436\0435\0440 1', 'manager1@crm.by', '$2b$10$zAyUnNz1ykutKrAYnS/ZC.PxQ8UfwbE8fIcH6G7LzXTFvGYZvtski', 'manager', NULL, NULL, NULL),
  (U&'\041c\0435\043d\0435\0434\0436\0435\0440 2', 'manager2@crm.by', '$2b$10$zAyUnNz1ykutKrAYnS/ZC.PxQ8UfwbE8fIcH6G7LzXTFvGYZvtski', 'manager', NULL, NULL, NULL)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  updated_at = now();
