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
  let called = false;
  await handleGiftOffers(fakeReq(), res, async () => { called = true; return []; });
  assert.equal(called, false); // пустой interests не должен вообще обращаться к Postgres
  const body = state.body as { offers: unknown[]; filtered: boolean };
  assert.ok(Array.isArray(body.offers));
  assert.equal(body.filtered, false);
});

test('interests с совпадениями возвращает только то, что отдал Postgres, с filtered=true', async () => {
  const { res, state } = fakeRes();
  const matched = [{ id: 'p1', title: 'Товар', url: 'https://example.test/p1', imageUrl: 'https://example.test/p1.jpg', price: 100, currency: 'RUB', category: '' }];
  await handleGiftOffers(fakeReq({ query: { interests: 'Йога,Фитнес' } } as any), res, async (interests) => {
    assert.deepEqual(interests, ['Йога', 'Фитнес']);
    return matched;
  });
  assert.deepEqual(state.body, { offers: matched, filtered: true });
});

test('interests без совпадений в Postgres откатывается на полный список с filtered=false', async () => {
  const { res, state } = fakeRes();
  await handleGiftOffers(fakeReq({ query: { interests: 'НесуществующийИнтерес' } } as any), res, async () => []);
  const body = state.body as { offers: unknown[]; filtered: boolean };
  assert.ok(Array.isArray(body.offers));
  assert.equal(body.filtered, false); // доказывает, что это ветка отката, а не случайно пустой matched
});

test('ошибка Data Connect откатывается на полный список вместо 500/пустого ответа', async () => {
  const { res, state } = fakeRes();
  await handleGiftOffers(fakeReq({ query: { interests: 'Йога' } } as any), res, async () => {
    throw new Error('Data Connect unavailable');
  });
  const body = state.body as { offers: unknown[]; filtered: boolean };
  assert.ok(Array.isArray(body.offers));
  assert.equal(body.filtered, false);
});

test('зависший SQL-запрос по таймауту откатывается на полный список', async () => {
  const { res, state } = fakeRes();
  await handleGiftOffers(fakeReq({ query: { interests: 'Йога' } } as any), res, () => new Promise(() => {})); // никогда не резолвится
  const body = state.body as { offers: unknown[]; filtered: boolean };
  assert.ok(Array.isArray(body.offers));
  assert.equal(body.filtered, false);
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
