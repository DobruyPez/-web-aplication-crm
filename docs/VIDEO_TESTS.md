# Автотесты видеозвонков

## Быстрый ответ «оба участника в кадре записи?»

Без браузера и WebRTC (рекомендуется сначала):

```bash
cd frontend
npm install
npm test -- --run src/lib/domRegionRecorder.test.js
```

Или из **корня** репозитория (`B:\Course\Project`):

```bash
npm run test:recording
# или все фронтенд-тесты:
npm test
```

Через pytest (тоже из корня):

```bash
pytest tests/test_video_recording_unit.py -q
```

**Не работает:** `npm test` из корня без `run` в старых версиях — используйте `npm run test:recording`.

Успех = compositor **склеивает левый и правый слот** (тест `mergeDualSlotCanvases includes BOTH slots`).  
Это не заменяет ручную проверку webm, но ловит регрессию «пустая правая половина» на уровне canvas.

Все unit-тесты фронтенда:

```bash
cd frontend && npm test -- --run
```

---

## Backend API (нужен запущенный сервер)

`tests/config.py` → `BASE_URL` (по умолчанию `http://localhost:3000`).

Скрипты `test:video:*` объявлены в **корне** репозитория (`B:\Course\Project\package.json`), не в `backend/package.json`.

```bash
# терминал 1
cd backend && npm run dev

# терминал 2 — из корня проекта:
cd B:\Course\Project
npm run test:video:api

# или из backend (прокси на корень):
cd backend
npm run test:video:api

# или напрямую pytest:
pytest tests/test_video_sessions_api.py tests/test_client_invite.py tests/test_video_upload_recording.py -q
```

Если сервер недоступен — тесты **skip**, не fail.

| Файл | Что проверяет |
|------|----------------|
| `test_video_sessions_api.py` | Сессия, join 2 гостя → 409, роли |
| `test_client_invite.py` | Публичный invite, start-video |
| `test_video_upload_recording.py` | Загрузка .webm, повтор → 409 |

---

## CI (GitHub Actions)

В `.github/workflows/ci.yml` гоняются pytest без live-сервера + перечисленные video-тесты (skip без API).

Отдельный шаг `npm test` для фронта в CI пока не добавлен — локально: `npm test` в `frontend/`.

---

## Лог записи видео (диагностика)

После `npm run build` на странице менеджера:

1. F12 → **Console** → фильтр `[VideoRecord]`
2. Кнопка **«Скачать лог»** под видеозвонком (JSON в `sessionStorage` + память)
3. В консоли: `downloadVideoRecordLogs()` / `getVideoRecordLogs()`
4. Серверный файл (после завершения звонка менеджером): `backend/uploads/debug/video-record-*.json`  
   Построчный лог: `backend/uploads/debug/video-record.log` (с `?videoRecordDebug=1` — каждая строка в реальном времени)

Ключевые поля в логе:

| Поле | Значение |
|------|----------|
| `remoteEmpty: true` | Правый слот не рисуется → чёрная половина в webm |
| `paintSuccess` / `paintAttempts` | Соотношение успешных кадров remote |
| `cloneOk: false` | Не удалось клонировать трек |
| `no live video track` | Нет video-трека у клиента в потоке записи |

**Инкогнито:** клиент в инкогнито — нормально. Запись идёт только на вкладке **менеджера**. На одном ПК (менеджер + инкогнито) часто одна физическая камера → на экране «два» окна, но в webm может быть дубль или пустой remote.

## Запись в Chrome (известное ограничение)

На экране оба `<video>` могут работать, а `canvas.drawImage()` со **второго видимого** WebRTC-элемента часто даёт **пустой кадр** — это ограничение Chromium, не «сломанный» backend.

Текущая реализация: для записи создаются **отдельные скрытые `<video>`** (по одному на video-трек менеджера и клиента), с `track.clone()` если браузер поддерживает. Видимая сетка UI не меняется.

## Что автотесты **не** покрывают

- Реальный WebRTC в Chrome (clone + скрытые video)
- Качество и синхронизацию звука в webm
- Полный E2E «менеджер + клиент в инкогнито»

Для этого — ручной прогон по `docs/VIDEO_CONFERENCE.md` или будущий Playwright.
