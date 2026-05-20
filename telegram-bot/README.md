# Telegram bot integration

This directory contains isolated Telegram notification logic used by the backend.

## Environment variables

- `TELEGRAM_BOT_TOKEN` - Telegram bot token from BotFather.
- `TELEGRAM_BOT_API_BASE` - optional, defaults to `https://api.telegram.org`.

## Notes

- Bot can send direct messages only to users who already started the bot and provided a valid `telegram_chat_id`.
- In this project, `telegram_chat_id` is stored per user in the `users` table.
