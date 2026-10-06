import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curateFeedOffers } from '../../server/feedCuration.js';
import type { TakprodamOffer } from '../../server/takprodam.js';

function offer(overrides: Partial<TakprodamOffer> & { id: string; title: string }): TakprodamOffer {
  return {
    url: `https://example.test/${overrides.id}`,
    imageUrl: `https://example.test/${overrides.id}.jpg`,
    price: 2000,
    currency: 'RUB',
    category: 'sport',
    ...overrides,
  };
}

test('отсекает товары дешевле 1000 ₽ (и без цены)', () => {
  const offers = [
    offer({ id: '1', title: 'Кроссовки беговые', price: 999 }),
    offer({ id: '2', title: 'Кроссовки трейловые', price: 1000 }),
    offer({ id: '3', title: 'Кроссовки зимние', price: null }),
  ];
  const result = curateFeedOffers(offers, []);
  assert.deepEqual(result.map((o) => o.id), ['2']);
});

test('отсекает товары со стоп-словами', () => {
  const offers = [
    offer({ id: '1', title: 'Стельки ортопедические зимние' }),
    offer({ id: '2', title: 'Кроссовки беговые Nike' }),
  ];
  const result = curateFeedOffers(offers, []);
  assert.deepEqual(result.map((o) => o.id), ['2']);
});

test('схлопывает дубли по первым двум словам названия', () => {
  const offers = [
    offer({ id: '1', title: 'Куртка зимняя красная, размер M' }),
    offer({ id: '2', title: 'Куртка зимняя синяя, размер L' }),
    offer({ id: '3', title: 'Рюкзак туристический 40л' }),
  ];
  const result = curateFeedOffers(offers, []);
  assert.equal(result.length, 2);
  const ids = result.map((o) => o.id);
  assert.ok(ids.includes('3'));
  assert.ok(ids.includes('1') || ids.includes('2'));
  assert.ok(!(ids.includes('1') && ids.includes('2'))); // только один из дублей
});

test('исключает товары из seen_ids', () => {
  const offers = [
    offer({ id: '1', title: 'Куртка зимняя' }),
    offer({ id: '2', title: 'Рюкзак туристический' }),
  ];
  const result = curateFeedOffers(offers, ['1']);
  assert.deepEqual(result.map((o) => o.id), ['2']);
});

test('отдаёт не больше 20 товаров, даже если прошло больше', () => {
  // У каждого товара свои первые два слова — иначе их схлопнул бы дедуп по модели, а не лимит
  const offers = Array.from({ length: 30 }, (_, i) => offer({ id: `p${i}`, title: `Товар${i} модель${i} уникальный экземпляр` }));
  const result = curateFeedOffers(offers, []);
  assert.equal(result.length, 20);
  assert.equal(new Set(result.map((o) => o.id)).size, 20); // без повторов
});

test('пустой вход даёт пустой результат без падения', () => {
  assert.deepEqual(curateFeedOffers([], []), []);
});
