-- Опционально: если нужен сид вручную под app_admin (обычно не нужен — npm run db:test-data идёт как postgres).
--   psql -U postgres -h localhost -d crm_course -f prisma/sql/grant_app_admin_seed.sql

GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_admin;
