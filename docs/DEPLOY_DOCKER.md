# Полный деплой CRM в Docker

Запускайте команды **из корня репозитория** (`B:\Course\Project` или ваш путь).

## Устранение неполадок

### `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`

Docker Engine **не запущен**. На Windows:

1. Запустите **Docker Desktop** из меню Пуск.
2. Дождитесь статуса **Engine running** (зелёный индикатор внизу).
3. Проверка:

```powershell
docker version
docker info
```

Если `docker version` снова падает с той же ошибкой — перезапустите Docker Desktop (**Restart**) или ПК; в настройках Docker: **Settings → General → Use the WSL 2 based engine** (если используете WSL).

Команды `build` / `up` имеют смысл **только после** успешного `docker version`.

### `Conflict: terminated by other getUpdates request`

Один и тот же `TELEGRAM_BOT_TOKEN` опрашивают **два процесса** (часто: `npm run dev` локально **и** контейнер `backend` с `TELEGRAM_POLLING_ENABLED=true` в `backend/.env`).

Что сделать:

1. Остановите локальный backend (терминал с `npm run dev` / `node src/server.js`).
2. В Docker polling по умолчанию **выключен** в `deploy/docker-compose.yml` (`TELEGRAM_POLLING_ENABLED: "false"`).
3. Перезапустите стек:

```powershell
docker compose -f deploy/docker-compose.yml up -d --force-recreate backend
```

Бот нужен **только в Docker** — остановите локальный backend и в `deploy/docker-compose.yml` для сервиса `backend` временно поставьте `TELEGRAM_POLLING_ENABLED: "true"`, затем `up -d --force-recreate backend`.

### `db-bootstrap` exit 1: `Added the required column product_name ... There are N rows`

В volume PostgreSQL осталась **старая** схема (сделки без `product_name`). Обновите образ и перезапустите bootstrap:

```powershell
docker compose -f deploy/docker-compose.yml build backend
docker compose -f deploy/docker-compose.yml run --rm db-bootstrap
docker compose -f deploy/docker-compose.yml up -d
```

Либо полный сброс данных: `docker compose -f deploy/docker-compose.yml down -v`, затем `up -d`.

### Bootstrap спрашивает `ignore the warning(s)?` и падает с exit 130

В неинтерактивном Docker `prisma db push` не должен ждать ввода. Пересоберите backend и снова:

```powershell
docker compose -f deploy/docker-compose.yml build backend
docker compose -f deploy/docker-compose.yml run --rm db-bootstrap
```

Скрипт bootstrap использует `db push --accept-data-loss` (удаление устаревших колонок вроде `clients.company` на dev-volume).

### `docker compose ps` пустой, но `logs backend` что-то показывает

`ps` пустой — контейнеры **сейчас не запущены** (часто из‑за остановленного Docker Engine). Строки в `logs` — из **прошлого** запуска. После старта Docker снова выполните `up -d` и проверьте `ps`.

## Предварительно

1. Установлены **Docker Desktop** (или Docker Engine + Compose v2), демон **запущен** (`docker version` без ошибок).
2. Файл **`backend/.env`** существует (скопируйте из `backend/.env.example` и при необходимости задайте `JWT_SECRET`, Telegram и т.д.).
3. Папки для загрузок (создаются автоматически при seed, но можно заранее):
   - `uploads/docs`, `uploads/voice`
   - `backend/uploads/docs`, `backend/uploads/video` — источник файлов для звонков/документов

## 1. Сборка и запуск стека

```powershell
cd B:\Course\Project

docker compose -f deploy/docker-compose.yml build

docker compose -f deploy/docker-compose.yml up -d
```

Что поднимается:

| Сервис        | Назначение |
|---------------|------------|
| `db`          | PostgreSQL 16, БД `crm_course` |
| `db-bootstrap`| `prisma db push` + `prisma db seed` (базовая схема и минимальный seed) |
| `backend`     | API на порту 4000 внутри сети |
| `nginx`       | UI + прокси API |

Дождитесь готовности backend:

```powershell
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs backend --tail 30
```

## 2. (Опционально) SQL-миграции вручную

Если схема в pgAdmin отставала от Prisma, выполните нужные файлы из `backend/prisma/sql/` в контейнере БД, например:

```powershell
docker compose -f deploy/docker-compose.yml exec -T db psql -U postgres -d crm_course -f - < backend/prisma/sql/migrate_product_name_to_deals_pgadmin.sql
```

На свежем деплое обычно достаточно `db-bootstrap` (`db push`).

## 3. Демо-наполнение (1000 клиентов, фильтры)

```powershell
.\scripts\seed-bulk-docker.ps1
```

Параметры:

- `-RebuildBackend` — пересобрать образ backend перед seed
- `-SkipClear` — не очищать БД перед вставкой (повторный прогон)
- `-DryRun` — только план, без записи

После `--clear` в БД остаются только учётки **`*@demo.crm.by`** (стандартный `admin@crm.by` из prisma seed удаляется).

**Вход после демо-seed:**

- Админ: `admin@demo.crm.by` / пароль `1234` (или `DEMO_SEED_PASSWORD`)
- Менеджер: например `aleksandr.kovalchuk@demo.crm.by` — см. список «Пользователи»

## 4. Адреса в браузере

```powershell
.\deploy\print-access.ps1
```

Обычно:

- **HTTP (удобно в LAN):** http://localhost:8088/
- **HTTPS:** https://localhost/ (нужны сертификаты в `certs/`)

Проверка API:

```powershell
curl http://localhost:8088/api/health
```

## 5. Остановка и полный сброс

```powershell
# Остановить контейнеры
docker compose -f deploy/docker-compose.yml down

# Удалить и данные PostgreSQL (полный сброс БД)
docker compose -f deploy/docker-compose.yml down -v
```

Затем снова `build` → `up -d` → `seed-bulk-docker.ps1`.

## 6. Сброс паролей демо-учёток без перезаливки

```powershell
docker compose -f deploy/docker-compose.yml exec -T backend node scripts/reset-bulk-passwords.js
```

## Карточки в UI (после seed)

- **Клиенты** — заголовок карточки: **название компании** (`clients.name`), напр. `ООО «БелСофт»`.
- **Сделки** — заголовок: **предмет сделки** (`deals.product_name`); полное название сделки в `title`, напр. `Поставка оборудования — ООО «БелСофт»`.

## Локальный seed без Docker

```powershell
.\scripts\seed-bulk-local.ps1
```

Требуется `DATABASE_URL` в `backend/.env`, указывающий на ваш PostgreSQL.
