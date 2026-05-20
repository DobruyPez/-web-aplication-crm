const prisma = require("../config/prisma");
const { sendTelegramMessage, isBotEnabled } = require("../../../telegram-bot/botClient");

const isStartCommand = (text) => String(text || "").trim().toLowerCase() === "/start";
const extractUsernameFromLink = (link) => {
  const value = String(link || "").trim();
  if (!value) return "";
  const fromAt = value.startsWith("@") ? value.slice(1) : "";
  if (fromAt) return fromAt.toLowerCase();
  const match = value.match(/t\.me\/([A-Za-z0-9_]{3,})/i);
  return match?.[1]?.toLowerCase?.() || "";
};

const findUserByTelegramLink = async (username) => {
  if (!username) return null;
  const users = await prisma.user.findMany({
    where: {
      telegramLink: {
        not: null,
      },
    },
    select: { id: true, fullName: true, email: true, telegramLink: true },
  });
  return users.find((user) => extractUsernameFromLink(user.telegramLink) === username) || null;
};

const saveChatIdForUser = async ({ userId, chatId, username }) => {
  if (!userId || !chatId) return null;
  return prisma.user.update({
    where: { id: Number(userId) },
    data: {
      telegramChatId: String(chatId),
      ...(username ? { telegramLink: `https://t.me/${username}` } : {}),
    },
    select: { id: true, fullName: true, email: true },
  });
};

const processTelegramUpdate = async (update) => {
  if (!isBotEnabled()) {
    return { ok: true, skipped: "bot_disabled" };
  }

  const message = update?.message || update?.edited_message;
  const text = String(message?.text || "").trim();
  const chatId = message?.chat?.id;
  const username = String(message?.from?.username || "").trim().toLowerCase();
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H7_H9',location:'telegramWebhookService.js:processTelegramUpdate:parsed',message:'telegram update parsed',data:{hasText:Boolean(text),isStart:String(text).toLowerCase().startsWith('/start'),chatIdPresent:Boolean(chatId),usernamePresent:Boolean(username)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!chatId) {
    return { ok: true, skipped: "no_chat_id" };
  }

  const startPayload = isStartCommand(text);
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H9',location:'telegramWebhookService.js:processTelegramUpdate:isStart',message:'start command check',data:{isStart:Boolean(startPayload)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (startPayload) {
    if (!username) {
      await sendTelegramMessage({
        chatId,
        text: "Не удалось определить ваш Telegram username. Добавьте username в Telegram и повторите /start.",
      }).catch(() => {});
      return { ok: true, linked: false, reason: "missing_telegram_username" };
    }

    const user = await findUserByTelegramLink(username);
    // #region agent log
    fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H10',location:'telegramWebhookService.js:processTelegramUpdate:userLookupByLink',message:'user lookup by telegram username/link',data:{username,found:Boolean(user)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!user) {
      await sendTelegramMessage({
        chatId,
        text: `Пользователь CRM со ссылкой https://t.me/${username} не найден. Обратитесь к администратору.`,
      }).catch(() => {});
      return { ok: true, linked: false, reason: "user_not_found_by_link" };
    }

    const linked = await saveChatIdForUser({ userId: user.id, chatId, username });
    await sendTelegramMessage({
      chatId,
      text: `Готово! Chat ID привязан к пользователю CRM (${linked.fullName}).`,
    }).catch(() => {});
    return { ok: true, linked: true, userId: linked.id, via: "start_telegram_link" };
  }

  await sendTelegramMessage({
    chatId,
    text: "Бот CRM активен. Для привязки отправьте команду /start",
  }).catch(() => {});
  return { ok: true, linked: false, reason: "help_sent" };
};

module.exports = {
  processTelegramUpdate,
};
