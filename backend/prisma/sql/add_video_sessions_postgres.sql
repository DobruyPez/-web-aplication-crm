-- Полная установка таблиц видеоконференций — ТОЛЬКО под пользователем postgres.
-- После выполнения Prisma (app_admin) сможет работать с таблицами.

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

ALTER TABLE public.client_invite_tokens OWNER TO app_admin;
ALTER TABLE public.video_sessions OWNER TO app_admin;
ALTER SEQUENCE IF EXISTS public.client_invite_tokens_id_seq OWNER TO app_admin;

CREATE INDEX IF NOT EXISTS idx_video_sessions_manager ON public.video_sessions(manager_id);
CREATE INDEX IF NOT EXISTS idx_client_invite_tokens_client ON public.client_invite_tokens(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_sessions TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_invite_tokens TO app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_admin;
