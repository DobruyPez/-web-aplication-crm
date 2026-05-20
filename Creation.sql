-- Таблица пользователей приложения (учётные записи администраторов и менеджеров)
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'manager')),
    phone         VARCHAR(30),
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now()
);

-- Клиенты
CREATE TABLE clients (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    company    VARCHAR(255),
    phone      VARCHAR(30),
    email      VARCHAR(255),
    address    TEXT,
    notes      TEXT,
    manager_id INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at TIMESTAMP    NOT NULL DEFAULT now()
);

-- Сделки
CREATE TABLE deals (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(255)   NOT NULL,
    description  TEXT,
    amount       DECIMAL(12,2),
    stage        VARCHAR(50)    NOT NULL,
    closing_date DATE,
    client_id    INT            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    manager_id   INT            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at   TIMESTAMP      NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP      NOT NULL DEFAULT now()
);

-- Задачи (автор – всегда менеджер)
CREATE TABLE tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(30)  NOT NULL DEFAULT 'new',
    priority    VARCHAR(10)  NOT NULL DEFAULT 'medium',
    due_date    TIMESTAMP,
    author_id   INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    client_id   INT          REFERENCES clients(id) ON DELETE SET NULL,
    deal_id     INT          REFERENCES deals(id) ON DELETE SET NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- Звонки
CREATE TABLE calls (
    id            SERIAL PRIMARY KEY,
    client_id     INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    caller_id     INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    direction     VARCHAR(10)  NOT NULL CHECK (direction IN ('in', 'out')),
    status        VARCHAR(20)  NOT NULL DEFAULT 'completed',
    duration      INT,         -- секунды
    recording_url TEXT,
    started_at    TIMESTAMP    NOT NULL,
    ended_at      TIMESTAMP
);

-- Документы
CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    client_id   INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    uploader_id INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    filename    VARCHAR(255) NOT NULL,
    file_path   TEXT         NOT NULL,
    file_size   BIGINT,
    mime_type   VARCHAR(100),
    uploaded_at TIMESTAMP    NOT NULL DEFAULT now()
);

-- Роль администратора приложения
CREATE ROLE app_admin WITH LOGIN PASSWORD 'admin_secure_pass';

-- Роль менеджера
CREATE ROLE app_manager WITH LOGIN PASSWORD 'manager_secure_pass';

-- Привилегии для app_admin
GRANT CONNECT ON DATABASE crm_db TO app_admin;
GRANT USAGE ON SCHEMA public TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_admin;

-- Привилегии для app_manager – зеркально те же
GRANT CONNECT ON DATABASE crm_db TO app_manager;
GRANT USAGE ON SCHEMA public TO app_manager;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_manager;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_manager;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_manager;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_manager;