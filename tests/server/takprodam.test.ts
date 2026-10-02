import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCategoryOffers } from '../../server/takprodam.js';

const originalFetch = globalThis.fetch;
process.env.TAKPRODAM_API_TOKEN = 'test-token';

test('fetchCategoryOffers помечает каждый оффер переданной категорией', async () => {
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      items: [{
        id: 'p1',
        title: 'Кроссовки беговые',
        image_url: 'https://example.test/p1.jpg',
        price: 3990,
        marketplace_title: 'Ozon',
        tracking_link: 'https://example.test/track/p1',
        external_link: 'https://example.test/p1',
      }],
      total_count: 1,
    }),
  })) as unknown as typeof fetch;

  try {
    const offers = await fetchCategoryOffers(13, 'sport', 'source-1', 10);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].category, 'sport');
    assert.equal(offers[0].id, 'p1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
