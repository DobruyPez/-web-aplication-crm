-- Выполнить ОДИН РАЗ под суперпользователем PostgreSQL (обычно postgres).
-- После этого app_admin сможет создавать таблицы (prisma db execute / db push).
GRANT CREATE ON SCHEMA public TO app_admin;
