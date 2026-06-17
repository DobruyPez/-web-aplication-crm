-- Связь сделок с документами (только документы того же client_id, что и сделка).
--
-- Если prisma db execute пишет «нет доступа к таблице deals» — используйте
-- prisma/sql/add_deal_documents_postgres.sql под пользователем postgres.

CREATE TABLE IF NOT EXISTS deal_documents (
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_documents_document ON deal_documents(document_id);
