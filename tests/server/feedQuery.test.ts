import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFeedProductsByInterests } from '../../server/feedQuery.js';

function fakeDataConnect(rows: Array<{ externalId: string; title: string; imageUrl: string; link: string; priceAmount: number | null; priceCurrency: string | null; category: string }>) {
  return {
    async executeGraphql(_query: string, _opts?: unknown) {
      return { data: { feedProductInterests: rows.map((product) => ({ product })) } };
    },
  } as any;
}

test('возвращает товары в формате TakprodamOffer', async () => {
  const dc = fakeDataConnect([
    { externalId: 'p1', title: 'Коврик для йоги', imageUrl: 'https://example.test/p1.jpg', link: 'https://example.test/p1', priceAmount: 1990, priceCurrency: 'RUB', category: 'sport' },
  ]);
  const offers = await getFeedProductsByInterests(['Йога'], dc);
  assert.deepEqual(offers, [{
    id: 'p1', title: 'Коврик для йоги', url: 'https://example.test/p1',
    imageUrl: 'https://example.test/p1.jpg', price: 1990, currency: 'RUB', category: 'sport',
  }]);
});

test('дедуплицирует товар, совпавший по нескольким интересам сразу', async () => {
  const row = { externalId: 'p1', title: 'Товар', imageUrl: 'https://example.test/p1.jpg', link: 'https://example.test/p1', priceAmount: null, priceCurrency: null, category: 'sport' };
  const dc = fakeDataConnect([row, row]);
  const offers = await getFeedProductsByInterests(['Йога', 'Фитнес'], dc);
  assert.equal(offers.length, 1);
});

test('пустой список интересов не обращается к Data Connect и возвращает пустой список', async () => {
  let called = false;
  const dc = { async executeGraphql() { called = true; return { data: { feedProductInterests: [] } }; } } as any;
  const offers = await getFeedProductsByInterests([], dc);
  assert.deepEqual(offers, []);
  assert.equal(called, false);
});
