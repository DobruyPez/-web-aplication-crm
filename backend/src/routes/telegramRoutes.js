const express = require("express");
const { processTelegramUpdate } = require("../services/telegramWebhookService");

const router = express.Router();

const verifyWebhookSecret = (req, res, next) => {
  const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    // #region agent log
    fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H6',location:'telegramRoutes.js:verifyWebhookSecret:no-secret',message:'webhook secret disabled',data:{hasExpected:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return next();
  }
  const received = String(req.header("x-telegram-bot-api-secret-token") || "").trim();
  // #region agent log
  fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H6',location:'telegramRoutes.js:verifyWebhookSecret:compare',message:'webhook secret check',data:{hasExpected:true,hasReceived:Boolean(received),matched:received===expected},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (received !== expected) {
    return res.status(401).json({ message: "Invalid telegram webhook secret." });
  }
  return next();
};

router.post("/webhook", verifyWebhookSecret, async (req, res, next) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H7',location:'telegramRoutes.js:webhook:entry',message:'telegram webhook request accepted',data:{hasMessage:Boolean(req?.body?.message),hasEditedMessage:Boolean(req?.body?.edited_message)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const result = await processTelegramUpdate(req.body);
    res.json(result);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7528/ingest/99f3b4fb-7261-4f8c-b7dc-f809feeb71de',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d6199e'},body:JSON.stringify({sessionId:'d6199e',runId:'webhook-trace',hypothesisId:'H8',location:'telegramRoutes.js:webhook:exception',message:'telegram webhook handler failed',data:{errorMessage:String(error?.message||'unknown')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    next(error);
  }
});

module.exports = router;
