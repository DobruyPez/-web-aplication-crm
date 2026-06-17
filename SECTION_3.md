# SECTION_3 — буфер раздела 2 (логическая модель БД и функционал)

Черновик для пояснительной записки. Содержимое соответствует репозиторию CRM Course Project (`backend/prisma/schema.prisma`, `Creation.sql`, сервисы и маршруты frontend/backend).

---

## Функции пользователя с ролью «Менеджер»

- просмотр личного кабинета (`/profile`, `GET /api/auth/me`);
- просмотр, добавление, изменение, удаление своих задач (ресурс `tasks`, область видимости по `author_id`);
- добавление, удаление, изменение своих клиентов (ресурс `clients`, область видимости по `manager_id`);
- добавление, удаление, изменение своих сделок (ресурс `deals`, область видимости по `manager_id`);
- просмотр истории звонков по своим клиентам, прослушивание и просмотр записей звонков (ресурс `calls`, `GET /api/calls` — только звонки клиентов менеджера; воспроизведение по `recording_url` в разделе «Звонки» и на панели управления; ручное создание, изменение и удаление звонков менеджеру запрещено — HTTP 403);
- загрузка, скачивание и удаление документов с сервера (вкладка «Загрузка файлов» → `uploads/docs/`; метаданные в `documents` только по своим клиентам);
- начало видеозвонка, запись звонка (раздел «Видеозвонки»: создание видеосессии `POST /api/video-sessions` — исходящий по выбору клиента или входящий по ссылке `/client-invite/…`; комната хоста `/calls/video-host/:sessionId`; клиенту передаётся `/calls/join/:guestToken`; запись `video/webm` в Chrome при подключении второго участника; после завершения сессии файл загружается на сервер и автоматически создаётся запись в `calls`);
- получение уведомлений с сервера (блок «Уведомления» на панели управления — `GET /api/dashboard/overview`, просроченные задачи, рисковые сделки, пропущенные звонки; дублирование в Telegram при настроенном `telegram_chat_id`);
- просмотр документов по своим клиентам (ресурс `documents`, скачивание по `file_path`).

**Не входит в роль менеджера:** управление пользователями; ручная загрузка файлов в `uploads/voice` и ручное создание звонков (это функции администратора); старт видеосессии администратором.

---

## Функции пользователя с ролью «Гость»

Роль «Гость» не хранится в таблице `users`. Клиент действует по токенам `client_invite_tokens` и `video_sessions.guest_token` без JWT.

- получение ссылки на звонок (публичная страница `/client-invite/:token` — просмотр контекста клиента и менеджера; копирование канонической ссылки для менеджера при входящем сценарии; кнопка «Войти в видеозвонок» — `POST /api/client-invite/:token/start-video`, переход на `/calls/join/:guestToken`; участие в двухсторонней видеоконференции по WebRTC, не более одного гостя в сессии).

---

## Сводка: звонки и видеосвязь в проекте

| Сущность / API | Назначение |
| --- | --- |
| `calls` | Журнал коммуникаций; для менеджера — только чтение и воспроизведение |
| `video_sessions` | Активная видеоконференция WebRTC (менеджер + один гость) |
| `client_invite_tokens` | Публичное приглашение клиента (`/client-invite/:token`) |
| `POST /api/clients/:id/invite-link` | Менеджер выдаёт ссылку приглашения клиенту |
| `POST /api/video-sessions` | Менеджер создаёт видеосессию |
| `POST /api/video-sessions/:id/recording` | Загрузка записи `.webm` |
| `POST /api/video-sessions/:id/end` | Завершение сессии; при наличии записи — строка в `calls` |
| `ws(s)://…/ws/video?guestToken=…` | Сигналинг WebRTC (через nginx в Docker) |

Ограничения реализации: браузер Google Chrome; в комнате ровно 2 участника (менеджер-хост и клиент); администратор не входит в двухсторонний звонок.

---

**Таблица 2.3 – Функциональные возможности (роль «Менеджер»), звонки и видео**

| № | Вариант использования | Пояснение |
| --- | --- | --- |
| 1 | Журнал звонков | `GET /api/calls` — только клиенты с `manager_id` текущего пользователя |
| 2 | Прослушивание записи | `recording_url` → файл в `uploads/voice/` (audio/video в UI) |
| 3 | Ссылка приглашения | `POST /api/clients/:id/invite-link` → `/client-invite/:token` |
| 4 | Исходящий видеозвонок | Выбор клиента → `POST /api/video-sessions`, `direction=out` |
| 5 | Входящий видеозвонок | Вставка client-invite URL → `direction=in` |
| 6 | Комната хоста | `/calls/video-host/:sessionId`, guest-ссылка `/calls/join/…` |
| 7 | Запись и завершение | Автозапись при 2 участниках → upload → `end` → запись в `calls` |

**Таблица 2.4 – Функциональные возможности (роль «Гость»)**

| № | Вариант использования | Пояснение |
| --- | --- | --- |
| 1 | Страница приглашения | `/client-invite/:token`, `GET /api/client-invite/:token` |
| 2 | Ссылка менеджеру | Копирование канонической ссылки (входящий сценарий) |
| 3 | Ссылка на видеозвонок | `POST …/start-video` → `joinUrl` / `/calls/join/:guestToken` |
| 4 | Видеоконференция | WebRTC без JWT; сигналинг `/ws/video` |

---

**Листинг 2.1 – Создание базы данных CRM (PostgreSQL)**

```sql
-- Создание базы данных (выполняется под суперпользователем postgres)
-- CREATE DATABASE crm_db;
-- \c crm_db

-- Таблица пользователей (администраторы и менеджеры)
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'manager'
                  CHECK (role IN ('admin', 'manager')),
  phone           VARCHAR(30),
  telegram_link   VARCHAR(255),
  telegram_chat_id VARCHAR(64),
  created_at      TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT now()
);

-- Клиенты организации
CREATE TABLE clients (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  company     VARCHAR(255),
  phone       VARCHAR(30),
  email       VARCHAR(255),
  address     TEXT,
  notes       TEXT,
  manager_id  INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- Сделки
CREATE TABLE deals (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255)   NOT NULL,
  description  TEXT,
  amount       DECIMAL(12, 2),
  stage        VARCHAR(50)    NOT NULL DEFAULT 'new',
  closing_date DATE,
  client_id    INT            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  manager_id   INT            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMP      NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP      NOT NULL DEFAULT now()
);

-- Задачи CRM
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
  id             SERIAL PRIMARY KEY,
  client_id      INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  caller_id      INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  direction      VARCHAR(10)  NOT NULL DEFAULT 'out'
                 CHECK (direction IN ('in', 'out')),
  status         VARCHAR(20)  NOT NULL DEFAULT 'completed',
  duration       INT,
  recording_url  TEXT,
  started_at     TIMESTAMP    NOT NULL,
  ended_at       TIMESTAMP
);

-- Документы клиентов (метаданные; файл на диске в uploads/)
CREATE TABLE documents (
  id           SERIAL PRIMARY KEY,
  client_id    INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploader_id  INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filename     VARCHAR(255) NOT NULL,
  file_path    TEXT         NOT NULL,
  file_size    BIGINT,
  mime_type    VARCHAR(100),
  uploaded_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- Связь сделок и документов (многие-ко-многим)
CREATE TABLE deal_documents (
  deal_id      INT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  document_id  INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, document_id)
);

-- Токены приглашения клиента на публичную страницу
CREATE TABLE client_invite_tokens (
  id          SERIAL PRIMARY KEY,
  token       VARCHAR(64) NOT NULL UNIQUE,
  client_id   INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  manager_id  INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at  TIMESTAMP    NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- Видеосессии (WebRTC)
CREATE TABLE video_sessions (
  id                   VARCHAR(36) PRIMARY KEY,
  manager_id           INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_id            INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction            VARCHAR(10)  NOT NULL DEFAULT 'out',
  guest_token          VARCHAR(64)  NOT NULL UNIQUE,
  status               VARCHAR(20)  NOT NULL DEFAULT 'active',
  recording_started_at TIMESTAMP,
  recording_url        TEXT,
  started_at           TIMESTAMP    NOT NULL DEFAULT now(),
  ended_at             TIMESTAMP
);

CREATE INDEX idx_video_sessions_manager ON video_sessions(manager_id);
CREATE INDEX idx_client_invite_tokens_client ON client_invite_tokens(client_id);
CREATE INDEX idx_deal_documents_document ON deal_documents(document_id);
```

В листинге 2.1 представлен SQL-скрипт основных таблиц CRM в PostgreSQL. Структура согласована со схемой Prisma и миграциями проекта. Файлы документов и записей разговоров хранятся в `uploads/docs/` и `uploads/voice/`; в БД — пути и метаданные.

Информационное хранилище — PostgreSQL. Логическая модель включает сущности CRM, роли `admin` и `manager`, гостевой доступ по токенам и видеосессии WebRTC.

---

**Таблица 2.5 – Назначение таблиц базы данных**

| Таблица | Назначение |
| --- | --- |
| users | Учётные записи администраторов и менеджеров |
| clients | Клиенты организации, привязка к менеджеру |
| deals | Сделки с клиентами |
| tasks | Задачи менеджеров |
| calls | Журнал звонков и ссылок на записи |
| documents | Метаданные файлов клиентов |
| deal_documents | Связь сделок и документов (M:N) |
| client_invite_tokens | Публичные приглашения клиента |
| video_sessions | Видеоконференции WebRTC (менеджер ↔ гость) |

---

**Таблица 2.6 – Структура таблицы users**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор пользователя |
| full_name | VARCHAR(255) | ФИО |
| email | VARCHAR(255) | E-mail (уникальный) |
| password_hash | VARCHAR(255) | Хеш пароля (bcrypt) |
| role | VARCHAR(20) | `admin` или `manager` |
| telegram_link | VARCHAR(255), NULL | Ссылка на Telegram |
| telegram_chat_id | VARCHAR(64), NULL | ID чата для бота |
| phone | VARCHAR(30), NULL | Телефон |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

---

**Таблица 2.7 – Структура таблицы clients**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор клиента |
| name | VARCHAR(255) | Имя |
| company | VARCHAR(255), NULL | Компания |
| phone | VARCHAR(30), NULL | Телефон |
| email | VARCHAR(255), NULL | E-mail |
| address | TEXT, NULL | Адрес |
| notes | TEXT, NULL | Заметки |
| manager_id | INTEGER, FK → users.id | Ответственный менеджер |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

---

**Таблица 2.8 – Структура таблицы deals**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор сделки |
| title | VARCHAR(255) | Название |
| description | TEXT, NULL | Описание |
| amount | DECIMAL(12,2), NULL | Сумма |
| stage | VARCHAR(50) | Этап воронки (`new` по умолчанию) |
| closing_date | DATE, NULL | Плановая дата закрытия |
| client_id | INTEGER, FK → clients.id | Клиент |
| manager_id | INTEGER, FK → users.id | Менеджер |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

---

**Таблица 2.9 – Структура таблицы tasks**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор задачи |
| title | VARCHAR(255) | Заголовок |
| description | TEXT, NULL | Описание |
| status | VARCHAR(30) | Статус (`new` по умолчанию) |
| priority | VARCHAR(10) | Приоритет (`medium` по умолчанию) |
| due_date | TIMESTAMP, NULL | Срок |
| author_id | INTEGER, FK → users.id | Автор (менеджер) |
| client_id | INTEGER, NULL | Связанный клиент |
| deal_id | INTEGER, NULL | Связанная сделка |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

---

**Таблица 2.10 – Структура таблицы calls**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор звонка |
| client_id | INTEGER, FK → clients.id | Клиент |
| caller_id | INTEGER, FK → users.id | Менеджер-инициатор |
| direction | VARCHAR(10) | `in` / `out` |
| status | VARCHAR(20) | `completed`, `missed`, `failed` и др. |
| duration | INTEGER, NULL | Длительность, сек |
| recording_url | TEXT, NULL | Путь, напр. `/uploads/voice/….webm` |
| started_at | TIMESTAMP | Начало |
| ended_at | TIMESTAMP, NULL | Конец |

Таблица `calls` — журнал коммуникаций. Для менеджера записи появляются после завершения видеосессии (если загружена запись); ручной `POST/PUT/DELETE` по `/api/calls` для менеджера возвращает 403. Администратор может создавать и править звонки вручную с привязкой к файлу в `uploads/voice/`.

---

**Таблица 2.11 – Структура таблицы documents**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор |
| client_id | INTEGER, FK → clients.id | Клиент |
| uploader_id | INTEGER, FK → users.id | Кто загрузил |
| filename | VARCHAR(255) | Имя файла |
| file_path | TEXT | Путь, напр. `/uploads/docs/…` |
| file_size | BIGINT, NULL | Размер, байт |
| mime_type | VARCHAR(100), NULL | MIME |
| uploaded_at | TIMESTAMP | Время загрузки |

---

**Таблица 2.12 – Структура таблицы deal_documents**

| Поле | Тип | Назначение |
| --- | --- | --- |
| deal_id | INTEGER, PK, FK → deals.id | Сделка |
| document_id | INTEGER, PK, FK → documents.id | Документ |

---

**Таблица 2.13 – Структура таблицы client_invite_tokens**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | INTEGER, PK | Идентификатор |
| token | VARCHAR(64), UNIQUE | Токен в URL `/client-invite/…` |
| client_id | INTEGER, FK → clients.id | Клиент |
| manager_id | INTEGER, FK → users.id | Менеджер |
| expires_at | TIMESTAMP | Срок действия |
| created_at | TIMESTAMP | Дата создания |

---

**Таблица 2.14 – Структура таблицы video_sessions**

| Поле | Тип | Назначение |
| --- | --- | --- |
| id | VARCHAR(36), PK | UUID сессии |
| manager_id | INTEGER, FK → users.id | Менеджер-хост |
| client_id | INTEGER, FK → clients.id | Клиент |
| direction | VARCHAR(10) | `in` / `out` |
| guest_token | VARCHAR(64), UNIQUE | Токен для `/calls/join/…` |
| status | VARCHAR(20) | `active`, `ended` |
| recording_started_at | TIMESTAMP, NULL | Старт записи (2 участника) |
| recording_url | TEXT, NULL | Путь к `.webm` |
| started_at | TIMESTAMP | Начало сессии |
| ended_at | TIMESTAMP, NULL | Завершение |

При `POST /api/video-sessions/:id/end` при наличии `recording_url` создаётся связанная запись в `calls` с тем же файлом и расчётом `duration`.
