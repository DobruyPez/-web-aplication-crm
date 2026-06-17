const { isBotEnabled } = require("../../../telegram-bot/botClient");
const { processTelegramUpdate } = require("./telegramWebhookService");

const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_BOT_API_BASE = process.env.TELEGRAM_BOT_API_BASE || "https://api.telegram.org";
const TELEGRAM_POLLING_ENABLED = String(process.env.TELEGRAM_POLLING_ENABLED || "").toLowerCase() === "true";
const TELEGRAM_POLLING_INTERVAL_MS = Number.parseInt(process.env.TELEGRAM_POLLING_INTERVAL_MS || "1500", 10);
const TELEGRAM_POLLING_TIMEOUT_SEC = Number.parseInt(process.env.TELEGRAM_POLLING_TIMEOUT_SEC || "25", 10);

let pollingTimer = null;
let pollingOffset = 0;
let inFlight = false;

const buildApiUrl = (method) => `${TELEGRAM_BOT_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/${method}`;

const deleteWebhookForPolling = async () => {
  const response = await fetch(buildApiUrl("deleteWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    const msg = payload?.description || `HTTP ${response.status}`;
    throw new Error(`Telegram deleteWebhook failed: ${msg}`);
  }
};

const pollOnce = async () => {
  if (inFlight || !isBotEnabled()) {
    return;
  }
  inFlight = true;
  try {
    const qs = new URLSearchParams({
      offset: String(pollingOffset),
      timeout: String(Math.max(1, TELEGRAM_POLLING_TIMEOUT_SEC)),
      allowed_updates: JSON.stringify(["message", "edited_message"]),
    });
    const response = await fetch(`${buildApiUrl("getUpdates")}?${qs.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      throw new Error(payload?.description || `HTTP ${response.status}`);
    }
    const updates = Array.isArray(payload.result) ? payload.result : [];
    for (const update of updates) {
      pollingOffset = Math.max(pollingOffset, Number(update.update_id || 0) + 1);
      await processTelegramUpdate(update);
    }
  } catch (error) {
    console.error("[telegram-polling] poll error:", error.message);
  } finally {
    inFlight = false;
  }
};

const startTelegramPolling = async () => {
  if (!TELEGRAM_POLLING_ENABLED) {
    console.warn(
      "[telegram] Polling выключен (TELEGRAM_POLLING_ENABLED не true). " +
        "Для Docker/localhost задайте TELEGRAM_POLLING_ENABLED=true в .env и перезапустите backend. " +
        "Webhook с Telegram на localhost не доставляется — нужен polling или публичный HTTPS URL.",
    );
    return { started: false, reason: "disabled" };
  }
  if (!isBotEnabled()) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN не задан — бот не запущен. Добавьте токен BotFather в корневой .env (env_file в docker-compose).",
    );
    return { started: false, reason: "bot_token_missing" };
  }
  try {
    await deleteWebhookForPolling();
  } catch (error) {
    console.error("[telegram-polling] unable to switch from webhook to polling:", error.message);
    return { started: false, reason: "delete_webhook_failed" };
  }

  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  pollingTimer = setInterval(() => {
    pollOnce().catch(() => {});
  }, Math.max(700, TELEGRAM_POLLING_INTERVAL_MS));

  pollOnce().catch(() => {});
  console.log("[telegram-polling] started");
  return { started: true };
};

module.exports = {
  startTelegramPolling,
};
