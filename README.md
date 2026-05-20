# CRM Course Project

Учебный проект CRM на `React + Express + Prisma`.

## Требования

- Node.js 18+ (рекомендуется LTS)
- npm 9+
- PostgreSQL (локально)

## Установка

Выполните из корня проекта:

```bash
npm --prefix backend install
npm --prefix frontend install
```

## Настройка окружения

1. Backend:
   - скопируйте `backend/.env.example` в `backend/.env`
   - укажите корректный `DATABASE_URL`
2. Frontend:
   - скопируйте `frontend/.env.example` в `frontend/.env`
   - при необходимости поменяйте `VITE_API_BASE_URL`

## Подготовка Prisma

После настройки `DATABASE_URL`:

```bash
npm run prisma:generate
npm --prefix backend run prisma:migrate
```

## Запуск проекта

Откройте два терминала в корне проекта.

1. Backend:

```bash
npm run dev:backend
```

2. Frontend:

```bash
npm run dev:frontend
```

По умолчанию:
- API: `http://localhost:4000` (или `https://localhost:4443`, если включен HTTPS в `backend/.env`)
- Frontend (Vite): `http://localhost:5173`

## Полезные команды

```bash
# Сборка frontend
npm run build:frontend

# Прод-запуск backend
npm run start:backend

# Генерация dev-сертификатов (self-signed)
npm run certs

# Генерация сертификатов через mkcert
npm run certs:mkcert
```
