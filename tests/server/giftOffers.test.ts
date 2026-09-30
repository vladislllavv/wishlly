import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGiftOffers } from '../../server/routes/giftOffers.js';
import { fakeReq, fakeRes } from './helpers.js';

// getGdeslonOffers() при холодном кэше не только читает кэш, но и синхронно запускает фоновое
// обновление (реальные fetch к CATEGORY_FEEDS на gdeslon.ru, см. server/gdeslon.ts). В тестах это
// недопустимо (сеть, минуты таймаута) — подменяем fetch, чтобы фоновая попытка провалилась
// мгновенно и не пережила этот тест-процесс.
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => Promise.reject(new Error('network disabled in tests'))) as typeof fetch;

test('gift-offers отвечает списком офферов без падения при холодном кэше', () => {
  const { res, state } = fakeRes();
  handleGiftOffers(fakeReq(), res);
  assert.ok(Array.isArray((state.body as { offers: unknown[] }).offers));
});

test.after(() => {
  globalThis.fetch = originalFetch;
  // Ассерт выше уже прошёл; фоновый scheduleRefresh() внутри gdeslon.ts (см. комментарий сверху)
  // продолжает докручивать пойманные заглушкой ретраи ещё ~минуту и без надобности держит процесс
  // живым — тест уже получил всё, что ему нужно, форсируем выход не дожидаясь этого хвоста.
  process.exit(0);
});
