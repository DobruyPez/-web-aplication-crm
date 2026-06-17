-- =============================================================================
-- Скрипт для pgAdmin (без Prisma migrate): контактные лица + поля клиента.
-- База: public, таблица clients и связанные.
--
-- Что делает:
--   1) client_contact_persons + contact_person_id (если ещё нет)
--   2) product_name у clients; name = название компании; заголовок карточки = товар
--   3) перенос: company -> name, старое name -> product_name; удаление company
--
-- Перед запуском: сделайте бэкап. Выполняйте целиком в Query Tool (F5).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Контактные лица (если таблицы ещё нет)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_contact_persons (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name  VARCHAR(255) NOT NULL,
  role       VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contact_persons_client
  ON public.client_contact_persons(client_id);

ALTER TABLE public.client_contact_points
  ADD COLUMN IF NOT EXISTS contact_person_id INTEGER
  REFERENCES public.client_contact_persons(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_contact_points_person
  ON public.client_contact_points(contact_person_id);

INSERT INTO public.client_contact_persons (client_id, full_name, role, sort_order)
SELECT cp.client_id, cp.contact_name, NULL, MIN(cp.sort_order)
FROM public.client_contact_points cp
WHERE TRIM(COALESCE(cp.contact_name, '')) <> ''
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

-- ---------------------------------------------------------------------------
-- 2. Клиент: product_name, name = компания, убрать company
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

-- Сохранить старое «имя» как название товара (пока product_name пусто)
UPDATE public.clients
SET product_name = name
WHERE product_name IS NULL OR TRIM(product_name) = '';

-- В name перенести юр. название из company, если оно было заполнено
UPDATE public.clients
SET name = company
WHERE company IS NOT NULL AND TRIM(company) <> '';

-- Пустые product_name после переноса — дублируем name
UPDATE public.clients
SET product_name = name
WHERE product_name IS NULL OR TRIM(product_name) = '';

ALTER TABLE public.clients
  ALTER COLUMN product_name SET NOT NULL;

DO $drop_company$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'company'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN company;
  END IF;
END $drop_company$;

COMMIT;

-- Проверка (опционально):
-- SELECT id, name AS company_name, product_name FROM public.clients ORDER BY id LIMIT 20;
