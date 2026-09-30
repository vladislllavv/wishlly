import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleTelegramWebhook } from '../../server/routes/telegramWebhook.js';
import { fakeReq, fakeRes } from './helpers.js';

process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';

test('telegram-webhook отклоняет запрос без секрета', async () => {
  const { res, state } = fakeRes();
  await handleTelegramWebhook(fakeReq({ headers: {}, body: {} }), res);
  assert.equal(state.code, 403);
});

test('telegram-webhook отклоняет запрос с неверным секретом', async () => {
  const { res, state } = fakeRes();
  await handleTelegramWebhook(
    fakeReq({ headers: { 'x-telegram-bot-api-secret-token': 'wrong' }, body: {} }),
    res,
  );
  assert.equal(state.code, 403);
});

test('telegram-webhook принимает валидный секрет и отвечает ok для обычного апдейта', async () => {
  const { res, state } = fakeRes();
  // Апдейт без /start — sendMessage не вызывается, поэтому не нужен реальный TELEGRAM_BOT_TOKEN/сеть.
  await handleTelegramWebhook(
    fakeReq({
      headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
      body: { message: { text: 'привет', chat: { id: 1 } } },
    }),
    res,
  );
  assert.equal(state.body, 'ok');
});
