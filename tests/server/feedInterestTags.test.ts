import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagInterests } from '../../server/feedInterestTags.js';

test('тегирует интерес по ключевому слову внутри совместимой корзины', () => {
  assert.deepEqual(tagInterests('sport', 'Коврик для йоги премиум'), ['Йога']);
});

test('не тегирует интерес из чужой тематической корзины, даже если слово совпало', () => {
  // "кроссовки" есть в словаре интереса "Обувь", но корзина sport не включает "Обувь"
  // в список кандидатов — категория должна отсекать это до проверки ключевых слов.
  const tags = tagInterests('sport', 'Беговые кроссовки премиум-класса');
  assert.deepEqual(tags, ['Бег']);
});

test('товар без совпадений возвращает пустой список, а не ошибку', () => {
  assert.deepEqual(tagInterests('sport', 'Неопознанный спортивный товар XZ'), []);
});

test('неизвестная (ещё не описанная) категория возвращает пустой список', () => {
  assert.deepEqual(tagInterests('unknown-bucket', 'Любой товар'), []);
});

test('товар может получить несколько тегов одновременно', () => {
  const tags = tagInterests('odejda', 'Зимняя куртка и шапка в комплекте');
  assert.deepEqual([...tags].sort(), ['Аксессуары', 'Одежда']);
});
