-- Контактные лица клиента (несколько человек с каналами связи).
-- psql -U postgres -d crm_course -v ON_ERROR_STOP=1 -f prisma/sql/add_client_contact_persons_postgres.sql

CREATE TABLE IF NOT EXISTS public.client_contact_persons (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name  VARCHAR(255) NOT NULL,
  role       VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contact_persons_client ON public.client_contact_persons(client_id);

ALTER TABLE public.client_contact_points
  ADD COLUMN IF NOT EXISTS contact_person_id INTEGER REFERENCES public.client_contact_persons(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_contact_points_person ON public.client_contact_points(contact_person_id);

-- Перенос существующих точек: одно лицо на каждое уникальное contact_name у клиента.
INSERT INTO public.client_contact_persons (client_id, full_name, role, sort_order)
SELECT cp.client_id, cp.contact_name, NULL, MIN(cp.sort_order)
FROM public.client_contact_points cp
WHERE TRIM(cp.contact_name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contact_persons p
    WHERE p.client_id = cp.client_id AND p.full_name = cp.contact_name
  )
GROUP BY cp.client_id, cp.contact_name;

UPDATE public.client_contact_points cp
SET contact_person_id = p.id
FROM public.client_contact_persons p
WHERE p.client_id = cp.client_id
  AND p.full_name = cp.contact_name
  AND cp.contact_person_id IS NULL;
