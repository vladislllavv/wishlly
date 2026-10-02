import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGiftOffers } from '../../server/routes/giftOffers.js';
import { fakeReq, fakeRes } from './helpers.js';

// getTakprodamOffers() при холодном кэше не только читает кэш, но и синхронно запускает фоновое
// обновление (реальные fetch к api.takprodam.ru, см. server/takprodam.ts). В тестах это
// недопустимо (сеть) — подменяем fetch, чтобы фоновая попытка провалилась мгновенно, и убеждаемся,
// что TAKPRODAM_API_TOKEN/TAKPRODAM_SOURCE_ID не заданы, так что buildOffers падает ещё раньше fetch.
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => Promise.reject(new Error('network disabled in tests'))) as typeof fetch;
delete process.env.TAKPRODAM_API_TOKEN;
delete process.env.TAKPRODAM_SOURCE_ID;

test('без параметра interests отвечает списком офферов без падения при холодном кэше', async () => {
  const { res, state } = fakeRes();
  await handleGiftOffers(fakeReq(), res, async () => []);
  assert.ok(Array.isArray((state.body as { offers: unknown[] }).offers));
});

test('interests с совпадениями возвращает только то, что отдал Postgres', async () => {
  const { res, state } = fakeRes();
  const matched = [{ id: 'p1', title: 'Товар', url: 'https://example.test/p1', imageUrl: 'https://example.test/p1.jpg', price: 100, currency: 'RUB', category: '' }];
  await handleGiftOffers(fakeReq({ query: { interests: 'Йога,Фитнес' } } as any), res, async (interests) => {
    assert.deepEqual(interests, ['Йога', 'Фитнес']);
    return matched;
  });
  assert.deepEqual(state.body, { offers: matched });
});

test('interests без совпадений в Postgres откатывается на полный список', async () => {
  const { res, state } = fakeRes();
  await handleGiftOffers(fakeReq({ query: { interests: 'НесуществующийИнтерес' } } as any), res, async () => []);
  assert.ok(Array.isArray((state.body as { offers: unknown[] }).offers));
});

test('ошибка Data Connect откатывается на полный список вместо 500/пустого ответа', async () => {
  const { res, state } = fakeRes();
  await handleGiftOffers(fakeReq({ query: { interests: 'Йога' } } as any), res, async () => {
    throw new Error('Data Connect unavailable');
  });
  assert.ok(Array.isArray((state.body as { offers: unknown[] }).offers));
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
