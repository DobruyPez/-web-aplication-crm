-- Выполнить под суперпользователем postgres (pgAdmin / DBeaver).
-- Нужно, если таблицы video_sessions / client_invite_tokens уже есть,
-- но prisma db execute от app_admin падает с «нужно быть владельцем таблицы».

ALTER TABLE IF EXISTS public.video_sessions OWNER TO app_admin;
ALTER TABLE IF EXISTS public.client_invite_tokens OWNER TO app_admin;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'client_invite_tokens_id_seq') THEN
    ALTER SEQUENCE public.client_invite_tokens_id_seq OWNER TO app_admin;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_video_sessions_manager ON public.video_sessions(manager_id);
CREATE INDEX IF NOT EXISTS idx_client_invite_tokens_client ON public.client_invite_tokens(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_sessions TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_invite_tokens TO app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_admin;

SELECT tablename, tableowner
FROM pg_tables
WHERE tablename IN ('video_sessions', 'client_invite_tokens');