-- ВНИМАНИЕ: выполняйте от app_admin только если таблиц ещё нет.
-- Если ошибка «владелец таблицы» / «нет доступа к схеме» — используйте в pgAdmin:
--   prisma/sql/fix_video_tables_owner.sql  (таблицы уже есть)
--   prisma/sql/add_video_sessions_postgres.sql  (полная установка от postgres)

CREATE TABLE IF NOT EXISTS client_invite_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_sessions (
  id VARCHAR(36) PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL DEFAULT 'out',
  guest_token VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  recording_started_at TIMESTAMP(3),
  recording_url TEXT,
  started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS idx_video_sessions_manager ON video_sessions(manager_id);
CREATE INDEX IF NOT EXISTS idx_client_invite_tokens_client ON client_invite_tokens(client_id);
