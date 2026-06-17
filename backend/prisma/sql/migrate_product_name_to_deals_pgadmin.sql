-- =============================================================================
-- Перенос product_name с clients на deals (pgAdmin, без Prisma migrate).
-- Безопасно, если clients.product_name уже удалён.
-- После выполнения: cd backend && npx prisma generate && перезапуск API.
--
-- Перед запуском: бэкап. Выполнить целиком (F5).
-- =============================================================================

BEGIN;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

-- Копия из clients.product_name только если колонка ещё есть
DO $copy_from_clients$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'product_name'
  ) THEN
    EXECUTE $sql$
      UPDATE public.deals d
      SET product_name = c.product_name
      FROM public.clients c
      WHERE d.client_id = c.id
        AND c.product_name IS NOT NULL
        AND TRIM(c.product_name) <> ''
        AND (d.product_name IS NULL OR TRIM(d.product_name) = '')
    $sql$;
  END IF;
END $copy_from_clients$;

-- Пустые / NULL — из названия сделки
UPDATE public.deals
SET product_name = title
WHERE product_name IS NULL OR TRIM(product_name) = '';

ALTER TABLE public.deals
  ALTER COLUMN product_name SET NOT NULL;

DO $drop_client_product$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'product_name'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN product_name;
  END IF;
END $drop_client_product$;

COMMIT;

-- Проверка:
-- SELECT id, title, product_name, client_id FROM public.deals ORDER BY id LIMIT 20;
