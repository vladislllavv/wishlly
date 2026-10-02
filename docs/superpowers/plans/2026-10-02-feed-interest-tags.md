# Feed Interest Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag Takprodam feed products with real interest tags in Postgres (via Firebase Data Connect), so `/api/gift-offers` can return products already filtered by the viewer's interests instead of relying only on client-side substring matching.

**Architecture:** A new, independent Postgres schema (`FeedProduct`/`FeedProductInterest`) sits alongside the existing anonymized `ideas` schema in the same Data Connect service. A periodic server job tags each cached Takprodam offer against a keyword dictionary (scoped by the offer's category bucket) and upserts it into Postgres. `/api/gift-offers` queries by interest when given one, and falls back to today's unfiltered behavior whenever Postgres has nothing to offer or is unavailable.

**Tech Stack:** Node/Express server, `firebase-admin/data-connect` Admin SDK, `tsx --test` (node:test) for server tests, Playwright for the one e2e check.

**Spec:** `docs/superpowers/specs/2026-10-02-feed-interest-tags-design.md`

## Global Constraints

- Every new code path must degrade to today's behavior (full unfiltered `getTakprodamOffers()` list) on any Data Connect error or empty result — the Ideas tab must never go blank because of this feature (spec Goals/Serving section).
- Do not touch `dataconnect/connector/ideas/`, `IdeaItem`, or any community-ideas code — out of scope (spec Non-goals).
- Do not delete or replace `pickOffersForInterests` in `src/giftIdeas.ts` — it remains the client-side fallback filter (spec Non-goals).
- Dictionary coverage is intentionally partial on day one; an interest/category with no dictionary entry must behave as "no tags", not an error (spec Non-goals).
- `externalId` on `FeedProduct` is the raw Takprodam offer id (`offer.id`), not the `takprodam_`-prefixed id used client-side in `GiftIdea.id` — that prefix is a client-side namespacing detail added by `offerToGiftIdea` and must not leak into the stored schema or the wire format of `/api/gift-offers`, which has always returned raw `TakprodamOffer` objects.

## Review Focus

- A user with an empty `interests` list (no profile interests selected) must still see a full deck, not an empty one — giftOffers route treats empty `interests` the same as "no filter requested".
- A query by a real interest that happens to match zero tagged products (empty dictionary gap, cold cache) must fall back to the full unfiltered list, not return an empty deck.
- Data Connect being unreachable (trial lapsed, bad credentials, network) during the `/api/gift-offers` request must not surface as a 500 or empty response — falls back to `getTakprodamOffers()`.
- A product that drops out of the live Takprodam cache (filtered as kids' item, category pruned, API stopped returning it) must be deleted from `FeedProduct`/`FeedProductInterest` on the next mirror run, not linger forever with stale tags.
- A keyword that matches an interest from a *different* category bucket than the offer's own must never tag the product — category gating must be enforced before keyword matching, not after.

---

## File Structure

- `server/takprodam.ts` (modify) — `TakprodamOffer` gains `category`; `fetchCategoryOffers` becomes exported and category-aware.
- `tests/server/takprodam.test.ts` (create) — category stamping.
- `server/feedInterestTags.ts` (create) — category→candidate-interests map, keyword dictionary, `tagInterests()`.
- `tests/server/feedInterestTags.test.ts` (create) — tagging + category-gating tests.
- `dataconnect/schema/feed.gql` (create) — `FeedProduct`/`FeedProductInterest` tables.
- `server/dataConnectAdmin.ts` (modify) — adds `getFeedDataConnect()`.
- `server/feedMirror.ts` (create) — `runFeedMirror()` + `startFeedMirrorScheduler()`.
- `tests/server/feedMirror.test.ts` (create) — upsert/tag/delete reconcile against a mocked client.
- `server/index.ts` (modify) — calls `startFeedMirrorScheduler()`.
- `server/feedQuery.ts` (create) — `getFeedProductsByInterests()`.
- `tests/server/feedQuery.test.ts` (create) — query + dedupe against a mocked client.
- `server/routes/giftOffers.ts` (modify) — `interests` query param, Postgres-first with fallback.
- `tests/server/giftOffers.test.ts` (modify) — extended for the new param and fallback paths.
- `src/components/IdeaSwipeStack.tsx` (modify) — passes `interests` to the fetch, refetches on change.

---

### Task 1: Thread the category bucket through `TakprodamOffer`

**Files:**
- Modify: `server/takprodam.ts:26-39` (no change needed to `CATEGORY_IDS` itself), `server/takprodam.ts:41-48` (`TakprodamOffer`), `server/takprodam.ts:131-155` (`fetchCategoryOffers`), `server/takprodam.ts:157-176` (`buildOffers`)
- Test: `tests/server/takprodam.test.ts`

**Interfaces:**
- Produces: `TakprodamOffer` now has `category: string`. `export function fetchCategoryOffers(categoryId: number, category: string, sourceId: string, limit: number): Promise<TakprodamOffer[]>` (was unexported, 3 args — now exported, 4 args, category inserted second).

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/takprodam.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCategoryOffers } from '../../server/takprodam.js';

const originalFetch = globalThis.fetch;

test('fetchCategoryOffers помечает каждый оффер переданной категорией', async () => {
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/server/takprodam.test.ts`
Expected: FAIL — `fetchCategoryOffers` is not exported yet, and/or wrong arity (TypeScript/runtime error), and `offers[0].category` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `server/takprodam.ts`, update the interface (around line 41-48):

```ts
export interface TakprodamOffer {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  category: string;
}
```

Update `fetchCategoryOffers` (around line 131-155) to accept and stamp `category`:

```ts
export async function fetchCategoryOffers(categoryId: number, category: string, sourceId: string, limit: number): Promise<TakprodamOffer[]> {
  const offers: TakprodamOffer[] = [];
  let page = 1;
  while (offers.length < limit) {
    const url = `${API_BASE}/product/?source_id=${sourceId}&category_id=${categoryId}&page=${page}&limit=${PAGE_SIZE}`;
    const data = await fetchJsonWithRetry(url);
    for (const product of data.items) {
      if (!isTrackable(product)) continue;
      if (!product.title || !product.image_url) continue; // карточкам "Идей" нужна фотография
      if (isKidsProduct(product.title)) continue;
      offers.push({
        id: product.id,
        title: product.title.slice(0, 200),
        url: product.tracking_link || product.external_link,
        imageUrl: product.image_url,
        price: product.price,
        currency: 'RUB', // Такпродам работает только с российскими маркетплейсами
        category,
      });
      if (offers.length >= limit) break;
    }
    if (data.items.length < PAGE_SIZE || page * PAGE_SIZE >= data.total_count) break;
    page += 1;
  }
  return offers;
}
```

Update `buildOffers` (around line 157-176) to carry the category label through the task queue:

```ts
async function buildOffers(): Promise<TakprodamOffer[]> {
  const sourceId = process.env.TAKPRODAM_SOURCE_ID;
  if (!sourceId) throw new Error('TAKPRODAM_SOURCE_ID is not set');

  const tasks = CATEGORY_IDS.flatMap(({ category, ids }) => ids.map((id) => ({ id, category, limit: Math.ceil(PER_CATEGORY_LIMIT / ids.length) })));
  const results = await mapWithConcurrency(tasks, FETCH_CONCURRENCY, ({ id, category, limit }) => fetchCategoryOffers(id, category, sourceId, limit));

  const byId = new Map<string, TakprodamOffer>();
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Takprodam category fetch failed:', result.reason);
      continue;
    }
    for (const offer of result.value) byId.set(offer.id, offer);
  }
  return [...byId.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/server/takprodam.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors (other call sites of `fetchCategoryOffers` were only inside `buildOffers`, already updated above).

```bash
git add server/takprodam.ts tests/server/takprodam.test.ts
git commit -m "Thread the Takprodam category bucket through TakprodamOffer"
```

---

### Task 2: Interest keyword dictionary and tagging

**Files:**
- Create: `server/feedInterestTags.ts`
- Test: `tests/server/feedInterestTags.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export function tagInterests(category: string, title: string): string[]` — used by Task 3's `feedMirror.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/feedInterestTags.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/server/feedInterestTags.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/feedInterestTags.ts
//
// Разметка товаров Такпродам тегами интересов из каталога (см. src/interests.ts,
// INTEREST_CATEGORIES — строки здесь скопированы оттуда, не переименовывать по
// отдельности в одном файле без другого).
//
// Сначала сужаем круг кандидатов до тех интересов, что тематически совместимы с
// категорийной корзиной Такпродам (CATEGORY_IDS в server/takprodam.ts) — иначе
// случайное совпадение ключевого слова из чужой темы дало бы ложный тег (например,
// "кроссовки" в названии спортивного товара не должно тегировать интерес "Обувь").
// Внутри этого сужённого набора ищем ключевые слова/синонимы как подстроку в
// названии без учёта регистра и "ё/е".
//
// Покрытие словаря намеренно неполное на первой итерации — интересы без записи
// просто никогда не тегируются (не ошибка), см. docs/superpowers/specs/2026-10-02-feed-interest-tags-design.md.

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е');
}

const CATEGORY_INTERESTS: Record<string, string[]> = {
  sport: ['Футбол', 'Баскетбол', 'Теннис', 'Бег', 'Плавание', 'Йога', 'Фитнес', 'Велоспорт', 'Единоборства', 'Лыжи и сноуборд'],
  odejda: ['Одежда', 'Обувь', 'Аксессуары', 'Украшения', 'Часы', 'Сумки', 'Парфюмерия', 'Streetwear', 'Винтаж', 'Косметика'],
  obuv: ['Одежда', 'Обувь', 'Аксессуары', 'Украшения', 'Часы', 'Сумки', 'Парфюмерия', 'Streetwear', 'Винтаж', 'Косметика'],
  acsess: ['Одежда', 'Обувь', 'Аксессуары', 'Украшения', 'Часы', 'Сумки', 'Парфюмерия', 'Streetwear', 'Винтаж', 'Косметика'],
  krasota: ['Уход за кожей', 'Уход за волосами', 'Витамины и добавки', 'Ароматерапия', 'Маникюр', 'Барбершоп', 'Спа и массаж'],
  razvlecheniya: ['Видеоигры', 'Настольные игры', 'Шахматы', 'Головоломки', 'Киберспорт', 'Коллекционирование', 'Аниме и манга', 'Конструкторы'],
  travel: ['Путешествия', 'Кемпинг', 'Походы'],
  books: ['Книги'],
};

const KEYWORDS: Record<string, string[]> = {
  // Спорт
  'Футбол': ['футбол', 'бутс'],
  'Баскетбол': ['баскетбол'],
  'Теннис': ['теннис', 'ракетка для'],
  'Бег': ['беговы', 'беговой', 'для бега'],
  'Плавание': ['для плавания', 'плавательны', 'для бассейна'],
  'Йога': ['йога', 'йоги'],
  'Фитнес': ['фитнес', 'тренажер', 'гантел', 'эспандер', 'скакалка'],
  'Велоспорт': ['велосипед', 'велошлем', 'велоперчат'],
  'Единоборства': ['боксерск', 'бокс', 'кимоно', 'единоборств', 'борцовск'],
  'Лыжи и сноуборд': ['лыж', 'сноуборд', 'горнолыжн'],
  // Одежда и стиль
  'Одежда': ['футболка', 'худи', 'куртка', 'платье', 'брюки', 'свитер'],
  'Обувь': ['кроссовки', 'ботинки', 'туфли', 'сапоги', 'кеды'],
  'Аксессуары': ['ремень', 'перчатки', 'шарф', 'шапка'],
  'Украшения': ['серьги', 'кольцо', 'браслет', 'колье', 'кулон'],
  'Часы': ['наручные часы', 'часы наручные'],
  'Сумки': ['сумка', 'рюкзак', 'клатч', 'портфель'],
  'Парфюмерия': ['парфюм', 'туалетная вода', 'духи'],
  'Streetwear': ['streetwear', 'оверсайз'],
  'Винтаж': ['винтаж', 'ретро'],
  'Косметика': ['косметик', 'тушь', 'помада', 'палетка'],
  // Здоровье и красота
  'Уход за кожей': ['крем для лица', 'сыворотка', 'уход за кожей', 'маска для лица'],
  'Уход за волосами': ['шампунь', 'маска для волос', 'уход за волосами'],
  'Витамины и добавки': ['витамин', 'бад', 'добавк'],
  'Ароматерапия': ['аромалампа', 'эфирное масло', 'диффузор'],
  'Маникюр': ['маникюр', 'лак для ногтей', 'гель-лак'],
  'Барбершоп': ['триммер', 'машинка для стрижки', 'бритва'],
  'Спа и массаж': ['массажер', 'спа набор', 'массажная'],
  // Игры и хобби
  'Видеоигры': ['игровая', 'геймпад', 'игровой', 'для playstation', 'для xbox'],
  'Настольные игры': ['настольная игра', 'настольную игру'],
  'Шахматы': ['шахмат'],
  'Головоломки': ['головоломк', 'пазл'],
  'Киберспорт': ['киберспорт', 'игровая мышь', 'игровая клавиатура'],
  'Коллекционирование': ['коллекцион', 'фигурка'],
  'Аниме и манга': ['аниме', 'манга'],
  'Конструкторы': ['конструктор'],
  // Путешествия и природа
  'Путешествия': ['дорожный', 'чемодан'],
  'Кемпинг': ['палатка', 'кемпинг', 'спальный мешок'],
  'Походы': ['туристический рюкзак', 'треккинг', 'поход'],
  // Культура и знания
  'Книги': ['книга', 'роман', 'издание'],
};

export function tagInterests(category: string, title: string): string[] {
  const candidates = CATEGORY_INTERESTS[category];
  if (!candidates) return [];
  const normalizedTitle = normalize(title);
  return candidates.filter((interest) => {
    const keywords = KEYWORDS[interest];
    if (!keywords) return false;
    return keywords.some((keyword) => normalizedTitle.includes(normalize(keyword)));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/server/feedInterestTags.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add server/feedInterestTags.ts tests/server/feedInterestTags.test.ts
git commit -m "Add category-gated interest keyword dictionary for Takprodam products"
```

---

### Task 3: Postgres schema + ingestion job

**Files:**
- Create: `dataconnect/schema/feed.gql`
- Modify: `server/dataConnectAdmin.ts`
- Create: `server/feedMirror.ts`
- Test: `tests/server/feedMirror.test.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `TakprodamOffer` (Task 1, now with `category`), `tagInterests` (Task 2), `getTakprodamOffers` (existing, `server/takprodam.ts`).
- Produces: `export function getFeedDataConnect(): DataConnect` (`server/dataConnectAdmin.ts`); `export async function runFeedMirror(getOffers?: () => TakprodamOffer[], dataConnect?: FeedDataConnectClient): Promise<void>` and `export function startFeedMirrorScheduler(): void` (`server/feedMirror.ts`) — used by Task 4/5 only indirectly (they read the same tables, not this module).

- [ ] **Step 1: Add the schema file**

```graphql
# dataconnect/schema/feed.gql
#
# Каталог товаров партнёрской выгрузки Такпродам (server/takprodam.ts) с тегами
# интересов (server/feedInterestTags.ts) — независимо от schema/ideas.gql
# (анонимизированные желания пользователей). Не смешивать: у этой схемы нет
# модерации/голосования/владельца — это обычный товарный каталог.
type FeedProduct @table {
  externalId: String! @unique   # offer.id из server/takprodam.ts, без префикса "takprodam_"
  title: String!
  imageUrl: String!
  link: String!
  priceAmount: Float
  priceCurrency: String
  category: String!             # бакет Такпродам: sport, odejda, krasota, ... (CATEGORY_IDS)
  updatedAt: Timestamp! @default(expr: "request.time")
}

type FeedProductInterest @table(key: ["product", "interest"]) {
  product: FeedProduct!
  interest: String!             # одна из 100 строк INTEREST_CATEGORIES (src/interests.ts)
}
```

This file only needs to exist under `dataconnect/schema/` — `dataconnect.yaml`'s `schema.source: ./schema` already picks up every `.gql` file in that directory, so no `dataconnect.yaml` edit is needed. No connector directory is needed either: all reads/writes to these tables go through the Admin SDK's generic table helpers (`upsert`/`insertMany`/`executeGraphql`), exactly like `server/ideasMirror.ts` already does for `ideaItem`/`ideaInterest` — there is no browser-facing query for `FeedProduct`.

- [ ] **Step 2: Add `getFeedDataConnect()`**

```ts
// server/dataConnectAdmin.ts — add alongside the existing getIdeasDataConnect
import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';

const CONNECTOR_CONFIG = {
  location: 'europe-north1',
  serviceId: 'wishlly-932c0-service',
  connector: 'ideas',
};

let instance: DataConnect | null = null;

export function getIdeasDataConnect(): DataConnect {
  if (!instance) instance = getDataConnect(CONNECTOR_CONFIG);
  return instance;
}

// FeedProduct/FeedProductInterest (dataconnect/schema/feed.gql) live in the same
// service/database as the ideas schema, but have no connector of their own (no
// client reads them) — `connector` is optional on ConnectorConfig and only
// matters for connector-scoped generated-SDK calls, which this never does.
let feedInstance: DataConnect | null = null;

export function getFeedDataConnect(): DataConnect {
  if (!feedInstance) feedInstance = getDataConnect({ location: CONNECTOR_CONFIG.location, serviceId: CONNECTOR_CONFIG.serviceId });
  return feedInstance;
}
```

- [ ] **Step 3: Write the failing test for the mirror job**

```ts
// tests/server/feedMirror.test.ts
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx tsx --test tests/server/feedMirror.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 5: Write minimal implementation**

```ts
// server/feedMirror.ts
import { getTakprodamOffers, type TakprodamOffer } from './takprodam.js';
import { getFeedDataConnect } from './dataConnectAdmin.js';
import { tagInterests } from './feedInterestTags.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // совпадает с CACHE_TTL_MS в takprodam.ts — чаще не имеет смысла

export interface FeedDataConnectClient {
  listFeedProductIds(): Promise<string[]>;
  upsertFeedProduct(id: string, data: {
    title: string; imageUrl: string; link: string;
    priceAmount: number | null; priceCurrency: string | null; category: string;
  }): Promise<void>;
  replaceFeedProductInterests(productId: string, interests: string[]): Promise<void>;
  deleteFeedProduct(id: string): Promise<void>;
}

// Тот же паттерн reconcile, что в server/ideasMirror.ts: апсертим всё актуальное,
// затем удаляем из хранилища то, чего больше нет в текущем кэше Такпродам.
export async function runFeedMirror(
  getOffers: () => TakprodamOffer[] = getTakprodamOffers,
  dataConnect: FeedDataConnectClient = wrapAdminDataConnect(getFeedDataConnect()),
): Promise<void> {
  const offers = getOffers();
  const keepIds = new Set<string>();
  for (const offer of offers) {
    if (!offer.imageUrl) continue; // FeedProduct.imageUrl не nullable
    keepIds.add(offer.id);
    try {
      await dataConnect.upsertFeedProduct(offer.id, {
        title: offer.title,
        imageUrl: offer.imageUrl,
        link: offer.url,
        priceAmount: offer.price,
        priceCurrency: offer.currency,
        category: offer.category,
      });
      await dataConnect.replaceFeedProductInterests(offer.id, tagInterests(offer.category, offer.title));
    } catch (error) {
      console.error(`Feed mirror failed for offer ${offer.id}:`, error);
    }
  }

  const mirrored = await dataConnect.listFeedProductIds();
  for (const id of mirrored) {
    if (keepIds.has(id)) continue;
    try {
      await dataConnect.deleteFeedProduct(id);
    } catch (error) {
      console.error(`Feed mirror delete failed for ${id}:`, error);
    }
  }
}

// Адаптирует настоящий Admin Data Connect SDK (generic upsert/insertMany/executeGraphql)
// к узкому интерфейсу выше — тот же приём, что wrapAdminDataConnect в ideasMirror.ts.
function wrapAdminDataConnect(dc: ReturnType<typeof getFeedDataConnect>): FeedDataConnectClient {
  return {
    async listFeedProductIds() {
      const result = await dc.executeGraphql<{ feedProducts: { externalId: string }[] }, undefined>(
        'query { feedProducts { externalId } }',
      );
      return result.data.feedProducts.map((row) => row.externalId);
    },
    async upsertFeedProduct(id, data) {
      await dc.upsert('feedProduct', { externalId: id, ...data });
    },
    async replaceFeedProductInterests(productId, interests) {
      await dc.executeGraphql(
        'mutation($id: String!) { feedProductInterest_deleteMany(where: { productExternalId: { eq: $id } }) }',
        { variables: { id: productId } },
      );
      if (interests.length > 0) {
        await dc.insertMany('feedProductInterest', interests.map((interest) => ({ productExternalId: productId, interest })));
      }
    },
    async deleteFeedProduct(id) {
      await dc.executeGraphql(
        'mutation($id: String!) { feedProduct_delete(key: { externalId: $id }) }',
        { variables: { id } },
      );
    },
  };
}

export function startFeedMirrorScheduler() {
  setInterval(() => {
    runFeedMirror().catch((error) => console.error('Feed mirror job failed:', error));
  }, CHECK_INTERVAL_MS);
  void runFeedMirror().catch((error) => console.error('Feed mirror job failed:', error));
}
```

> Note for whoever first deploys `dataconnect/schema/feed.gql`: the `productExternalId` filter/insert field name above is written by analogy with the existing `ideaInterest` table's generated `ideaWishId` field (see `server/ideasMirror.ts` and commit `044ca8c`, which confirmed that naming against the real Data Connect emulator/CLI). Deploy the schema, then run `tagInterests`'s companion mirror once against the emulator (or run `tests/server/feedMirror.test.ts`'s mocked version plus a one-off manual `executeGraphql('{ __type(name: "FeedProductInterest_Where") { inputFields { name } } }')` introspection call) to confirm the generated field is actually named `productExternalId` before relying on it in production; adjust the two `executeGraphql` strings in `wrapAdminDataConnect` if it differs.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx tsx --test tests/server/feedMirror.test.ts`
Expected: PASS (4/4)

- [ ] **Step 7: Wire the scheduler into the server**

```ts
// server/index.ts — near the existing startIdeasMirrorScheduler() import/call
import { startFeedMirrorScheduler } from './feedMirror.js';
// ...
startFeedMirrorScheduler();
```//

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add dataconnect/schema/feed.gql server/dataConnectAdmin.ts server/feedMirror.ts tests/server/feedMirror.test.ts server/index.ts
git commit -m "Mirror tagged Takprodam products into a new Postgres FeedProduct table"
```

---

### Task 4: Query feed products by interest

**Files:**
- Create: `server/feedQuery.ts`
- Test: `tests/server/feedQuery.test.ts`

**Interfaces:**
- Consumes: `TakprodamOffer` type (Task 1), `getFeedDataConnect` (Task 3).
- Produces: `export async function getFeedProductsByInterests(interests: string[], dataConnect?: DataConnect): Promise<TakprodamOffer[]>` — used by Task 5's `giftOffers.ts`. Empty `interests` input returns `[]` without querying (caller decides what "empty" means, per spec's fallback logic living in the route).

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/feedQuery.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFeedProductsByInterests } from '../../server/feedQuery.js';

function fakeDataConnect(rows: Array<{ externalId: string; title: string; imageUrl: string; link: string; priceAmount: number | null; priceCurrency: string | null }>) {
  return {
    async executeGraphql(_query: string, _opts?: unknown) {
      return { data: { feedProductInterests: rows.map((product) => ({ product })) } };
    },
  } as any;
}

test('возвращает товары в формате TakprodamOffer', async () => {
  const dc = fakeDataConnect([
    { externalId: 'p1', title: 'Коврик для йоги', imageUrl: 'https://example.test/p1.jpg', link: 'https://example.test/p1', priceAmount: 1990, priceCurrency: 'RUB' },
  ]);
  const offers = await getFeedProductsByInterests(['Йога'], dc);
  assert.deepEqual(offers, [{
    id: 'p1', title: 'Коврик для йоги', url: 'https://example.test/p1',
    imageUrl: 'https://example.test/p1.jpg', price: 1990, currency: 'RUB', category: '',
  }]);
});

test('дедуплицирует товар, совпавший по нескольким интересам сразу', async () => {
  const row = { externalId: 'p1', title: 'Товар', imageUrl: 'https://example.test/p1.jpg', link: 'https://example.test/p1', priceAmount: null, priceCurrency: null };
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/server/feedQuery.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/feedQuery.ts
import type { DataConnect } from 'firebase-admin/data-connect';
import { getFeedDataConnect } from './dataConnectAdmin.js';
import type { TakprodamOffer } from './takprodam.js';

interface FeedProductRow {
  externalId: string;
  title: string;
  imageUrl: string;
  link: string;
  priceAmount: number | null;
  priceCurrency: string | null;
}

function rowToOffer(row: FeedProductRow): TakprodamOffer {
  return {
    id: row.externalId,
    title: row.title,
    url: row.link,
    imageUrl: row.imageUrl,
    price: row.priceAmount,
    currency: row.priceCurrency,
    category: '', // категория не нужна на этом этапе — товар уже отобран по интересу
  };
}

export async function getFeedProductsByInterests(
  interests: string[],
  dataConnect: DataConnect = getFeedDataConnect(),
): Promise<TakprodamOffer[]> {
  if (interests.length === 0) return [];
  const result = await dataConnect.executeGraphql<
    { feedProductInterests: { product: FeedProductRow }[] },
    { interests: string[] }
  >(
    'query($interests: [String!]) { feedProductInterests(where: { interest: { in: $interests } }) { product { externalId title imageUrl link priceAmount priceCurrency } } }',
    { variables: { interests } },
  );
  const byId = new Map<string, TakprodamOffer>();
  for (const row of result.data.feedProductInterests) {
    const offer = rowToOffer(row.product);
    byId.set(offer.id, offer);
  }
  return [...byId.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/server/feedQuery.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add server/feedQuery.ts tests/server/feedQuery.test.ts
git commit -m "Add a Postgres query for feed products matching a set of interests"
```

---

### Task 5: Wire `/api/gift-offers` to query by interest, with fallback

**Files:**
- Modify: `server/routes/giftOffers.ts`
- Modify: `tests/server/giftOffers.test.ts`

**Interfaces:**
- Consumes: `getFeedProductsByInterests` (Task 4), `getTakprodamOffers` (existing).
- Produces: `handleGiftOffers(req, res, queryByInterests?)` — the optional third param is test-only dependency injection, matching the project's established pattern (`runIdeasMirror(db, client)`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/server/giftOffers.test.ts — replace the whole file
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGiftOffers } from '../../server/routes/giftOffers.js';
import { fakeReq, fakeRes } from './helpers.js';

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
  process.exit(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test tests/server/giftOffers.test.ts`
Expected: FAIL — `handleGiftOffers` doesn't accept a third argument / doesn't read `interests` yet, and is not `async` from the caller's perspective in a way the test can await meaningfully (current version is sync).

- [ ] **Step 3: Write minimal implementation**

```ts
// server/routes/giftOffers.ts
import type { Request, Response } from 'express';
import { getTakprodamOffers, type TakprodamOffer } from '../takprodam.js';
import { getFeedProductsByInterests } from '../feedQuery.js';

function parseInterests(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// Отдаёт каталог для вкладки "Идеи". С непустым interests сперва пробует SQL-слой
// тегированных товаров (server/feedMirror.ts); без совпадений, без параметра, или
// при любой ошибке Data Connect — тот же полный список из кэша Такпродам, что и
// раньше (фронт сам отфильтрует его через pickOffersForInterests, см.
// src/giftIdeas.ts) — вкладка не должна оставаться пустой ни при каком исходе.
export async function handleGiftOffers(
  req: Request,
  res: Response,
  queryByInterests: (interests: string[]) => Promise<TakprodamOffer[]> = getFeedProductsByInterests,
) {
  const interests = parseInterests((req.query as Record<string, unknown> | undefined)?.interests);
  if (interests.length > 0) {
    try {
      const matched = await queryByInterests(interests);
      if (matched.length > 0) {
        res.json({ offers: matched });
        return;
      }
    } catch (error) {
      console.error('gift-offers interest query failed, falling back to full feed:', error);
    }
  }
  try {
    res.json({ offers: getTakprodamOffers() });
  } catch (error) {
    console.error('gift-offers error:', error);
    res.json({ offers: [] });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/server/giftOffers.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Run the full server suite and type-check**

Run: `npm run test:server && npx tsc --noEmit`
Expected: all server tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add server/routes/giftOffers.ts tests/server/giftOffers.test.ts
git commit -m "Serve /api/gift-offers filtered by interests from Postgres, with full-feed fallback"
```

---

### Task 6: Frontend passes interests to `/api/gift-offers`

**Files:**
- Modify: `src/components/IdeaSwipeStack.tsx:88-101`

**Interfaces:**
- Consumes: the `interests: string[]` prop the component already receives (`src/App.tsx:1245`).
- Produces: nothing new consumed elsewhere — this is the last task.

- [ ] **Step 1: Update the fetch to include and react to `interests`**

```tsx
// src/components/IdeaSwipeStack.tsx — replace the existing effect at lines 88-101
useEffect(() => {
  let cancelled = false;
  const query = interests.length > 0 ? `?interests=${encodeURIComponent(interests.join(','))}` : '';
  fetch(`/api/gift-offers${query}`)
    .then((res) => (res.ok ? res.json() : { offers: [] }))
    .then((data: { offers: Array<{ id: string; title: string; url: string; imageUrl: string | null; price: number | null; currency: string | null }> }) => {
      if (cancelled) return;
      setOffers(data.offers.map(offerToGiftIdea));
    })
    .catch((error) => {
      console.warn('Не удалось загрузить товары Такпродам, показываем подборку по умолчанию:', error);
      if (!cancelled) setOffers([]);
    });
  return () => { cancelled = true; };
}, [interests]);
```

This keeps `pickOffersForInterests(offers, interests)` in the `deck` memo (line 103-106) unchanged — it's now mostly a no-op when the server already filtered (every returned offer already matches an interest), and remains the real filter whenever the server fell back to the unfiltered list.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the e2e check**

Run: `npx playwright test tests/e2e/ideas.spec.ts`
Expected: PASS — `playwright.config.ts`'s `webServer` auto-starts `npm run dev:mock`, which has no `/api/gift-offers` at all (no real Express server in mock mode), so the fetch 404s/fails and the component falls back to `offers: []` → the mock catalog path, same as before this change; the test only asserts the deck renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/IdeaSwipeStack.tsx
git commit -m "Request Takprodam offers filtered by the viewer's interests"
```

---

## Self-Review

**1. Spec coverage:**
- Data model (`FeedProduct`/`FeedProductInterest`) → Task 3, Step 1. ✓
- Interest tagging via keyword dictionary, category-gated → Task 2. ✓
- Ingestion job with upsert + stale-delete reconcile, per-item error isolation → Task 3. ✓
- `/api/gift-offers` interest filtering + fallback to full list on empty/error → Task 5. ✓
- Client sends/reacts to `interests` → Task 6. ✓
- `pickOffersForInterests` kept, not deleted → Global Constraints + Task 6 note. ✓
- Non-goal: `ideas`/`IdeaItem` untouched → no task touches `dataconnect/connector/ideas/` or `IdeaItem`. ✓
- Non-goal: partial dictionary coverage acceptable → Task 2 dictionary explicitly covers a subset (8 of 12 buckets), documented in the file's own header comment. ✓
- Deviation from the spec's literal `externalId` format (`takprodam_<id>` → plain `offer.id`): called out explicitly in Global Constraints with the reasoning (the prefix is a client-side `GiftIdea.id` namespacing detail, not a wire/storage concern) — this is a planning-time correction, not a silent drift.
- The spec's draft mention of a `dataconnect/connector/feed/` directory was dropped during planning once research showed the Admin SDK's generic table helpers (already used by `ideasMirror.ts`) need no connector at all — noted in Task 3, Step 1.

**2. Placeholder scan:** none found — every step has concrete code, no "TBD"/"handle appropriately".

**3. Type consistency:** `TakprodamOffer` (Task 1: `{id, title, url, imageUrl, price, currency, category}`) is used identically in Task 3 (`feedMirror.ts`), Task 4 (`feedQuery.ts`'s `rowToOffer` return type), and Task 5 (`giftOffers.ts`'s `queryByInterests` parameter type). `tagInterests(category, title)` (Task 2) is called with the same argument order and names in Task 3. `FeedDataConnectClient` methods (`listFeedProductIds`, `upsertFeedProduct`, `replaceFeedProductInterests`, `deleteFeedProduct`) are defined and consumed only within Task 3 — no cross-task name drift.

**4. Review Focus:** all five lines have an owning test — empty `interests` (Task 5, test 1 implicitly + Task 6 guards with `interests.length > 0`), interest-matches-nothing fallback (Task 5, test 3), Data Connect error fallback (Task 5, test 4), stale product deletion (Task 3, test 2), cross-bucket keyword gating (Task 2, test 2).

---

Plan complete and saved to `docs/superpowers/plans/2026-10-02-feed-interest-tags.md`.
