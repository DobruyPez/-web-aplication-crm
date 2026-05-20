const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_API_BASE = process.env.TELEGRAM_BOT_API_BASE || "https://api.telegram.org";

const isBotEnabled = () => Boolean(String(TELEGRAM_BOT_TOKEN || "").trim());

const sendTelegramMessage = async ({ chatId, text }) => {
  if (!isBotEnabled() || !chatId || !text) {
    return { ok: false, skipped: true };
  }

  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H4',location:'botClient.js:sendTelegramMessage:request',message:'telegram api request start',data:{chatIdPreview: String(chatId).slice(0,4)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const response = await fetch(`${TELEGRAM_BOT_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: String(text),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // #region agent log
    fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H4',location:'botClient.js:sendTelegramMessage:error',message:'telegram api request failed',data:{status: response.status},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const error = new Error(`Telegram API error (${response.status}): ${body || "unknown error"}`);
    error.statusCode = response.status;
    throw error;
  }

  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'pre-fix',hypothesisId:'H4',location:'botClient.js:sendTelegramMessage:success',message:'telegram api request success',data:{status: response.status},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return response.json();
};

module.exports = {
  isBotEnabled,
  sendTelegramMessage,
};
