-- Связь сделок с документами (deal_documents).
-- Выполнить ОДИН РАЗ в pgAdmin / DBeaver / psql под пользователем postgres
-- (не под app_admin и не через npx prisma db execute).
--
--   psql -U postgres -h localhost -d crm_course -v ON_ERROR_STOP=1 -f prisma/sql/add_deal_documents_postgres.sql
--
-- После этого перезапустите backend (npx prisma generate — если ещё не делали).

CREATE TABLE IF NOT EXISTS public.deal_documents (
  deal_id INTEGER NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, document_id)
);

ALTER TABLE public.deal_documents OWNER TO app_admin;

CREATE INDEX IF NOT EXISTS idx_deal_documents_document ON public.deal_documents(document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_documents TO app_admin;
