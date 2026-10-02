// Интеграция с партнёрской сетью Такпродам (app.takprodam.ru, работает на технологии Admitad):
// подтягиваем каталог товаров через их публичный REST API, см.
// https://support.admitad.ru/article/ru/259-api-dlya-pablishera.html
//
// Пришла на замену интеграции с gdeslon.ru (см. историю git, server/gdeslon.ts) — та отдавала
// каталог только XML-выгрузками по ZIP-ссылкам, которые нужно было качать и парсить вручную.
// Такпродам отдаёт готовый JSON с партнёрской ссылкой (tracking_link) на каждый товар, поэтому
// никакого скачивания/распаковки/проверки картинок на "живость" не требуется.
//
// Категории — те же 13 тематических корзин, что были утверждены для gdeslon (см. CATEGORY_FEEDS
// в старой версии server/gdeslon.ts), чтобы пул товаров для подбора под интересы пользователя
// оставался таким же разнообразным. У Такпродам своя таксономия категорий (см. Get product
// categories list), поэтому сопоставление — лучшее приближение, не всегда 1:1:
//  - "акции" (товары со скидкой) у gdeslon были отдельной категорийной выгрузкой, а у Такпродам —
//    это вообще другой API-метод (Get promotions list/Get promotion products, не категория товара).
//    Не реализуем отдельную корзину под это в этой версии — остальные 12 категорий сохранены.
//  - "путешествия" и "сувениры" не существуют как отдельные категории у Такпродам (маркетплейсы
//    Ozon/Wildberries/Avito/AliExpress не продают туры и авиабилеты) — взяты ближайшие по смыслу
//    категории (туризм/кемпинг, товары для праздников и декор).
//
// Детские/товары для малышей сознательно исключены (не нужны для колоды "Идей" — она не про
// подарки младенцам): у Такпродам они не отдельная ветка каталога, а подкатегории внутри обычных
// разделов, поэтому вместо родительских id "Одежда"/"Хобби" (которые каскадно тянут и их) берём
// точные дочерние id, явно пропуская "Одежда для малышей" (25), "Бельё для малышей" (23) и
// "Детское творчество" (51).
const CATEGORY_IDS: { category: string; ids: number[] }[] = [
  { category: 'sport', ids: [13] }, // Спортивные товары
  { category: 'odejda', ids: [22, 24, 26, 27] }, // Бельё, головные уборы, одежда повседневная/спортивная
  { category: 'obuv', ids: [2] }, // Обувь
  { category: 'acsess', ids: [11] }, // Аксессуары
  { category: 'krasota', ids: [8] }, // Красота и здоровье
  { category: 'komputer', ids: [159] }, // Компьютеры и комплектующие
  { category: 'phone', ids: [167, 169] }, // Смартфоны и планшеты + умные часы и гаджеты
  { category: 'photo', ids: [171] }, // Фото и видеотехника
  { category: 'books', ids: [16] }, // Книги и канцелярия
  { category: 'razvlecheniya', ids: [50, 52, 53, 54, 55, 56, 57, 58, 59, 60, 115] }, // Хобби (без детского творчества) + цифровые товары
  { category: 'travel', ids: [133] }, // Туризм и кемпинг
  { category: 'suvenir', ids: [74, 64] }, // Товары для праздников + декор и интерьер
];

export interface TakprodamOffer {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  category: string;
}

interface ApiProduct {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  marketplace_title: string;
  tracking_link: string;
  external_link: string;
}

const API_BASE = 'https://api.takprodam.ru/v2/publisher';
const CACHE_TTL_MS = 30 * 60 * 1000;
// Сколько товаров набирать на каждую из 12 категорийных корзин — суммарно достаточно для
// разнообразной колоды свайпов, не перегружая кэш и не упираясь в лимиты API.
const PER_CATEGORY_LIMIT = Number(process.env.TAKPRODAM_OFFER_LIMIT) || 150;
const PAGE_SIZE = 100; // максимум, разрешённый API, — 1000, но берём поменьше ради равномерности пагинации
const REFRESH_TIMEOUT_MS = 8 * 60 * 1000;
const REFRESH_RETRY_DELAY_MS = 2 * 60 * 1000;
// Категорий больше, чем самих тематических корзин (некоторые разбиты на несколько конкретных
// id — см. CATEGORY_IDS), и каждая — отдельный запрос. Запустив их все разом, упираемся в 429 от
// API; поэтому гоняем их через общую очередь с ограниченным числом одновременных запросов.
const FETCH_CONCURRENCY = 4;
const RATE_LIMIT_RETRY_DELAY_MS = 2000;

let cache: { offers: TakprodamOffer[]; fetchedAt: number } | null = null;
let refreshPromise: Promise<void> | null = null;
let nextRefreshAt = 0;

function apiHeaders(): HeadersInit {
  const token = process.env.TAKPRODAM_API_TOKEN;
  if (!token) throw new Error('TAKPRODAM_API_TOKEN is not set');
  return { Authorization: `Bearer ${token}` };
}

// Партнёрские ссылки на Wildberries сейчас не отслеживаются (отключено на стороне Такпродам —
// see баннер "Wildberries: продвижение по ссылкам отключено" в кабинете), поэтому клик по такому
// товару не принёс бы ни трекинга, ни комиссии — такие офферы пропускаем.
function isTrackable(product: ApiProduct): boolean {
  return product.marketplace_title !== 'Wildberries';
}

// Исключение детских подкатегорий (см. CATEGORY_IDS) не ловит детские товары внутри обычных
// разделов — у Такпродам, например, "Палатка детская игровая" и "Обруч детский" лежат в общем
// спортинвентаре, а не в отдельной детской ветке. Единственный надёжный сигнал — само название.
const KIDS_KEYWORDS = ['детск', 'малыш', 'младенц', 'новорожд'];
function isKidsProduct(title: string): boolean {
  const lower = title.toLowerCase();
  return KIDS_KEYWORDS.some((word) => lower.includes(word));
}

// Запускает задачи с не более чем `limit` одновременно выполняющимися — без внешней зависимости.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Даже при FETCH_CONCURRENCY=4 все запросы на старте рефреша фактически стартуют единым залпом
// (каждый "воркер" берёт следующую задачу сразу после своей предыдущей) — Такпродам отвечал 429
// почти на всё (см. инцидент 2026-10-02: после каждого рестарта кэш товаров оставался пустым).
// Поэтому время старта САМОГО запроса (не параллелизм воркеров) дополнительно разносим общим
// тротлером: не чаще одного запроса раз в MIN_REQUEST_INTERVAL_MS на весь процесс.
// 350ms was still not enough — even with pagination capped (see MAX_PAGES_PER_CATEGORY), a refresh
// still timed out on 2026-10-02 with every request apparently needing its retries. Slowing down
// further; a background refresh taking longer costs nothing (the route always serves last-known
// cache immediately — see getTakprodamOffers), unlike a request that fails outright.
const MIN_REQUEST_INTERVAL_MS = 1500;
let nextRequestSlot = 0;
async function waitForRequestSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextRequestSlot - now);
  nextRequestSlot = Math.max(now, nextRequestSlot) + MIN_REQUEST_INTERVAL_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

// Логируем заголовки первого 429 за весь буилд — одного раза достаточно, чтобы понять их реальный
// лимит (Retry-After и т.п.), не заваливая журнал повторами одного и того же на каждый запрос.
let loggedRateLimitHeadersThisBuild = false;

async function fetchJsonWithRetry(url: string): Promise<{ items: ApiProduct[]; total_count: number }> {
  for (let attempt = 0; ; attempt++) {
    await waitForRequestSlot();
    const res = await fetch(url, { headers: apiHeaders() });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 2) {
      if (!loggedRateLimitHeadersThisBuild) {
        loggedRateLimitHeadersThisBuild = true;
        console.warn('Takprodam 429 headers:', Object.fromEntries(res.headers.entries()));
      }
      const retryAfterHeader = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : RATE_LIMIT_RETRY_DELAY_MS * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(`Takprodam product request failed: ${res.status}`);
  }
}

// Защитный потолок страниц на одну категорию: без него широкая категория (например "Спортивные
// товары", тысячи позиций), где большая доля офферов отсеивается фильтрами (WB, детское, нет
// фото), листалась бы почти до конца total_count в погоне за `limit` живых офферов — именно это
// повесило обновление на все 5 минут таймаута в проде 2026-10-02 (buildOffers завис, кэш так и не
// наполнился). 10 страниц (до 1000 просмотренных офферов) с запасом хватает каждой корзине.
const MAX_PAGES_PER_CATEGORY = 3;

export async function fetchCategoryOffers(categoryId: number, category: string, sourceId: string, limit: number): Promise<TakprodamOffer[]> {
  const offers: TakprodamOffer[] = [];
  let page = 1;
  while (offers.length < limit && page <= MAX_PAGES_PER_CATEGORY) {
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

async function buildOffers(): Promise<TakprodamOffer[]> {
  const sourceId = process.env.TAKPRODAM_SOURCE_ID;
  if (!sourceId) throw new Error('TAKPRODAM_SOURCE_ID is not set');
  loggedRateLimitHeadersThisBuild = false;

  // Один плоский список запросов (категория может состоять из нескольких id — см. CATEGORY_IDS),
  // прогнанный через общую очередь с ограничением параллелизма, а не Promise.all на каждую корзину
  // отдельно — иначе число одновременных запросов складывалось бы и упиралось в 429.
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

function scheduleRefresh(): void {
  if (refreshPromise || Date.now() < nextRefreshAt) return;
  const startedAt = Date.now();
  console.log('Takprodam refresh started');
  let refreshTimer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    refreshTimer = setTimeout(() => reject(new Error(`Takprodam refresh timed out after ${REFRESH_TIMEOUT_MS} ms`)), REFRESH_TIMEOUT_MS);
  });
  refreshPromise = Promise.race([buildOffers(), timeout])
    .then((offers) => {
      cache = { offers, fetchedAt: Date.now() };
      nextRefreshAt = Date.now() + CACHE_TTL_MS;
      console.log(`Takprodam refresh finished: ${offers.length} offers in ${Date.now() - startedAt} ms`);
    })
    .catch((error) => {
      console.error('Takprodam refresh failed:', error);
      nextRefreshAt = Date.now() + REFRESH_RETRY_DELAY_MS;
    })
    .finally(() => {
      clearTimeout(refreshTimer);
      refreshPromise = null;
    });
}

// Отдаёт то, что уже в кэше (пусто при холодном старте — см. комментарий в routes/giftOffers.ts),
// и в фоне планирует обновление, если кэш устарел или его ещё не было.
export function getTakprodamOffers(): TakprodamOffer[] {
  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) scheduleRefresh();
  return cache?.offers ?? [];
}

export function warmTakprodamCache(): void {
  scheduleRefresh();
}
