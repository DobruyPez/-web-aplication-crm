-- Контактные точки клиентов (телефон, факс, email с именем контактного лица).
-- Выполнить ОДИН РАЗ в pgAdmin / DBeaver / psql под пользователем postgres:
--
--   psql -U postgres -h localhost -d crm_course -v ON_ERROR_STOP=1 -f prisma/sql/add_client_contact_points_postgres.sql
--
-- После этого: npx prisma generate и перезапуск backend.

CREATE TABLE IF NOT EXISTS public.client_contact_points (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CHECK (type IN (
    'mobile', 'landline', 'phone', 'fax', 'email', 'website',
    'telegram', 'viber', 'whatsapp', 'skype', 'instagram', 'vk', 'ok', 'linkedin'
  )),
  value        VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contact_points OWNER TO app_admin;

CREATE INDEX IF NOT EXISTS idx_client_contact_points_client ON public.client_contact_points(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contact_points TO app_admin;
GRANT USAGE, SELECT ON SEQUENCE public.client_contact_points_id_seq TO app_admin;

-- Перенос существующих phone/email в контактные точки (если ещё не перенесены).
INSERT INTO public.client_contact_points (client_id, type, value, contact_name, sort_order)
SELECT c.id, 'phone', c.phone, 'Основной контакт', 0
FROM public.clients c
WHERE c.phone IS NOT NULL AND TRIM(c.phone) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contact_points cp
    WHERE cp.client_id = c.id AND cp.type = 'phone' AND cp.value = c.phone
  );

INSERT INTO public.client_contact_points (client_id, type, value, contact_name, sort_order)
SELECT c.id, 'email', c.email, 'Основной контакт', 0
FROM public.clients c
WHERE c.email IS NOT NULL AND TRIM(c.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contact_points cp
    WHERE cp.client_id = c.id AND cp.type = 'email' AND cp.value = c.email
  );
