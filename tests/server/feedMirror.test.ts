import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFeedMirror } from '../../server/feedMirror.js';
import type { TakprodamOffer } from '../../server/takprodam.js';

function fakeOffers(offers: TakprodamOffer[]) {
  return () => offers;
}

function fakeDataConnect(existingIds: string[] = []) {
  const products = new Map<string, Record<string, any>>();
  for (const id of existingIds) products.set(id, { title: 'старое' });
  const interests: { product: string; interest: string }[] = [];
  const deleted: string[] = [];
  return {
    client: {
      async listFeedProductIds() { return [...products.keys()]; },
      async upsertFeedProduct(id: string, data: Record<string, any>) { products.set(id, { ...products.get(id), ...data }); },
      async replaceFeedProductInterests(productId: string, tags: string[]) {
        for (let i = interests.length - 1; i >= 0; i--) if (interests[i].product === productId) interests.splice(i, 1);
        for (const interest of tags) interests.push({ product: productId, interest });
      },
      async deleteFeedProduct(id: string) { products.delete(id); deleted.push(id); },
    },
    products, interests, deleted,
  };
}

const sportOffer: TakprodamOffer = {
  id: 'p1', title: 'Коврик для йоги премиум', url: 'https://example.test/p1',
  imageUrl: 'https://example.test/p1.jpg', price: 2990, currency: 'RUB', category: 'sport',
};

test('новый оффер упсертится вместе со своими тегами', async () => {
  const dc = fakeDataConnect();
  await runFeedMirror(fakeOffers([sportOffer]), dc.client);
  assert.deepEqual(dc.products.get('p1'), {
    title: 'Коврик для йоги премиум', imageUrl: 'https://example.test/p1.jpg',
    link: 'https://example.test/p1', priceAmount: 2990, priceCurrency: 'RUB', category: 'sport',
  });
  assert.deepEqual(dc.interests, [{ product: 'p1', interest: 'Йога' }]);
});

test('оффер, пропавший из фида, удаляется вместе со своими тегами', async () => {
  const dc = fakeDataConnect(['p1', 'p2']);
  await runFeedMirror(fakeOffers([sportOffer]), dc.client); // p2 больше нет в фиде
  assert.equal(dc.products.has('p2'), false);
  assert.deepEqual(dc.deleted, ['p2']);
  assert.equal(dc.products.has('p1'), true);
});

test('товар без тегов (пустой словарь для категории) всё равно упсертится', async () => {
  const dc = fakeDataConnect();
  const untagged: TakprodamOffer = { ...sportOffer, id: 'p3', title: 'Неопознанный товар XZ' };
  await runFeedMirror(fakeOffers([untagged]), dc.client);
  assert.equal(dc.products.has('p3'), true);
  assert.deepEqual(dc.interests, []);
});

test('пустой фид (холодный кэш) не трогает ранее смирроренные товары', async () => {
  const dc = fakeDataConnect(['p1']);
  await runFeedMirror(fakeOffers([]), dc.client);
  assert.equal(dc.products.has('p1'), true);
  assert.deepEqual(dc.deleted, []);
});

test('ошибка на одном оффере не прерывает обработку остальных', async () => {
  const dc = fakeDataConnect();
  const broken: TakprodamOffer = { ...sportOffer, id: 'broken' };
  const originalUpsert = dc.client.upsertFeedProduct;
  dc.client.upsertFeedProduct = async (id: string, data: Record<string, any>) => {
    if (id === 'broken') throw new Error('boom');
    return originalUpsert(id, data);
  };
  await runFeedMirror(fakeOffers([broken, sportOffer]), dc.client);
  assert.equal(dc.products.has('p1'), true);
  assert.equal(dc.products.has('broken'), false);
});
