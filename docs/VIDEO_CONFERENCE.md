# Видеоконференции (CRM Course Project)

## Модель ссылок (Meet-like)

| Тип | Path | JWT | Назначение |
|-----|------|-----|------------|
| Client invite | `/client-invite/:token` | Нет | Контекст клиента; кнопки «ссылка менеджеру» и «Войти в видеозвонок» |
| Conference join | `/calls/join/:guestToken` | Нет* | Главная ссылка для гостя/клиента/наблюдателя |
| Manager host | `/calls/video-host/:sessionId` (в CRM) | Да (owner) | Комната хоста в Layout |
| Host URL (ошибочно) | `/calls/video/:sessionId` | Нет | Публичный редирект → `/calls/join/…` |

\* С JWT: admin → `admin_observer`, manager → `manager_peer`.

### Env

- Backend: `PUBLIC_APP_URL=https://localhost:5173` (или ваш HTTPS proxy)
- Frontend: `VITE_PUBLIC_APP_URL` — тот же origin, что видит пользователь в Chrome

Утилиты: `backend/src/utils/appBaseUrl.js`, `frontend/src/lib/appUrl.js`.

### API

- `POST /api/client-invite/:token/start-video` (public) — создать/найти сессию `direction=in`, вернуть `joinUrl`
- `GET /api/video-sessions/:id/public-hint` (public) — подсказка + `joinUrl` для редиректа с `/calls/video/...`

## Ограничения

- **Браузер:** только Google Chrome (WebRTC + MediaRecorder `video/webm`).
- **Участники:** **ровно 2** — менеджер-хост + один клиент по `/calls/join/:guestToken`. Третий участник → HTTP/WS **409** или **403**.
- **WebRTC:** одно peer-соединение host ↔ guest (не mesh N×N).

## Роли

| Действие | Менеджер | Админ |
|----------|----------|-------|
| Старт видеосессии | ✅ | ❌ |
| Ручная загрузка voice | ❌ | ✅ |
| Guest join | — | ✅ наблюдатель |

## Поток

1. Клиент открывает `/client-invite/:token`, копирует ссылку менеджеру.
2. Менеджер: «Видеозвонки» → «Начать видеоконференцию» → вставляет ссылку (in) или выбирает клиента (out).
3. Экран `/calls/video/:sessionId`, guest-ссылка `/calls/join/:guestToken`.
4. Запись стартует при ≥2 участниках; завершение → upload `.webm` → `Call` в БД.

## Signaling

- WebSocket: `ws(s)://<host>/ws/video?guestToken=...&peerId=...`
- STUN: `stun:stun.l.google.com:19302`

## Миграция таблиц (PostgreSQL)

В `.env` указан пользователь `app_admin` — у него нет `CREATE` на схему `public`, поэтому `prisma db execute` выдаёт «нет доступа к схеме public».

**Вариант A — один раз выдать право (рекомендуется), затем Prisma:**

```powershell
cd backend
# Подставьте пароль суперпользователя postgres
$env:PGPASSWORD = "ваш_пароль_postgres"
psql -U postgres -h localhost -d crm_db -v ON_ERROR_STOP=1 -f prisma/sql/grant_app_admin_create.sql
npx prisma db execute --file prisma/sql/add_video_sessions.sql --schema prisma/schema.prisma
npx prisma generate
```

**Вариант B — полная установка от postgres (рекомендуется):**

В pgAdmin/DBeaver откройте БД `crm_db` как **postgres** и выполните файл:
`backend/prisma/sql/add_video_sessions_postgres.sql`

**Вариант C — таблицы уже есть, ошибка «нужно быть владельцем таблицы video_sessions»:**

Таблицы созданы postgres, а `npx prisma db execute` от `app_admin` не может добавить индексы.
Выполните от **postgres** файл:
`backend/prisma/sql/fix_video_tables_owner.sql`

Затем только:
```powershell
cd backend
npx prisma generate
```
Повторять `add_video_sessions.sql` через prisma **не нужно**.

**Docker** (`deploy/docker-compose.yml`, БД `crm_course`):

```powershell
Get-Content backend\prisma\sql\add_video_sessions.sql | docker compose -f deploy\docker-compose.yml exec -T db psql -U postgres -d crm_course -v ON_ERROR_STOP=1
```

Сигналинг идёт через nginx: в `deploy/nginx/snippets/crm-locations.conf` должен быть `location /ws/video` с `Upgrade` / `Connection upgrade`. После правок nginx: `docker compose -f deploy/docker-compose.yml up -d --build nginx`.
