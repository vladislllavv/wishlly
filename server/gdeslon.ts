// Интеграция с партнёрской сетью gdeslon.ru: подтягиваем каталог товаров из XML-выгрузок
// (Кабинет → Инструменты → XML-Выгрузки). Раньше использовалась одна сквозная выгрузка на все
// категории (~8 млн офферов, непрактично для карточек "Идей"); сейчас в кабинете вручную собраны
// отдельные выгрузки по категориям (wishlly-ideas-feed<category>) — так подбор под интересы
// получается точнее. Выгрузка "feedhome" (~3.9 млн товаров, "Всё для дома") сознательно исключена —
// на порядок больше остальных и не даёт лучшей подборки для свайпов, только лишнюю нагрузку.
// Формат — Yandex Market XML, парсим регэкспами по тому же принципу, что и parseLink.ts,
// без добавления XML-парсера как зависимости.
//
// Важно: сами выгрузки отдаются кабинетом только в виде .zip, а сквозная выгрузка весит гигабайты —
// целиком в память грузить нельзя. Поэтому распаковываем поток через fflate и останавливаем
// закачку каждой выгрузки, как только набрали нужное число офферов с реально открывающейся
// картинкой (см. hasLiveImage) — для колоды свайпов миллионы товаров не нужны.
//
// Ещё один нюанс, обнаруженный на живом фиде: часть <picture> ссылок (прокси-ресайзер gdeslon,
// imgng.gdeslon.ru) мертва (404/502), и это не редкие случайные сбои, а нестабильность самого
// прокси под нагрузкой — поэтому предпочитаем original_picture (прямая ссылка на CDN
// рекламодателя, отвечает надёжно) и берём picture только как запасной вариант. Мёртвые ссылки
// на фиде идут не вперемешку, а кластерами, поэтому нельзя просто взять первые N офферов и
// отфильтровать — нужно продолжать читать поток, пока не наберём лимит живых или не упрёмся в
// защитный потолок (SCAN_LIMIT / SCAN_TIME_BUDGET_MS).

import { Unzip, UnzipInflate } from 'fflate';

export interface GdeslonOffer {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
}

// Категорийные выгрузки, вручную собранные в кабинете gdeslon (см. /export_files/) —
// "feedhome" (Всё для дома, ~3.9 млн офферов) намеренно не включён.
const CATEGORY_FEEDS: { category: string; url: string }[] = [
  { category: 'photo', url: 'https://export.gdeslon.ru/uploads/exports/556a82587250aeb7cd03b3b0b3030488210d949f.xml.zip' },
  { category: 'phone', url: 'https://export.gdeslon.ru/uploads/exports/6e883cf4249e44e12ae02c7b7be2edcad8ab4d0d.xml.zip' },
  { category: 'sport', url: 'https://export.gdeslon.ru/uploads/exports/1302f6e87d2be36bfeaa5774638a7f1e993c3927.xml.zip' },
  { category: 'akcia', url: 'https://export.gdeslon.ru/uploads/exports/5e5e09e4e0aba553d43247c201d889daeb619e9e.xml.zip' },
  { category: 'travel', url: 'https://export.gdeslon.ru/uploads/exports/8de1ec5317b5436e87471c17a1bf6f08ea8bef03.xml.zip' },
  { category: 'suvenir', url: 'https://export.gdeslon.ru/uploads/exports/8d72dfeca0cc26293a5c7fc230bf6db2e3372566.xml.zip' },
  { category: 'odejda', url: 'https://export.gdeslon.ru/uploads/exports/6902c9efb5a979a0af25ed2903560c42f5c630ed.xml.zip' },
  { category: 'obuv', url: 'https://export.gdeslon.ru/uploads/exports/a9612845846924eeef74e95dec20392ee95c8944.xml.zip' },
  { category: 'krasota', url: 'https://export.gdeslon.ru/uploads/exports/dc331565cc2a051d713d87058409277845910c4b.xml.zip' },
  { category: 'komputer', url: 'https://export.gdeslon.ru/uploads/exports/7a774e9b50f0f86e11a10fb1ccf87ca4d85fff46.xml.zip' },
  { category: 'books', url: 'https://export.gdeslon.ru/uploads/exports/9141e3cdef22789df3e6401ea61285113bfd7d83.xml.zip' },
  { category: 'razvlecheniya', url: 'https://export.gdeslon.ru/uploads/exports/5b1082e160a2a18a4afff48c10efde32e4b8ef0c.xml.zip' },
  { category: 'acsess', url: 'https://export.gdeslon.ru/uploads/exports/01ecf31ac8842ba196895baf4de078a17a2f2962.xml.zip' },
];

const CACHE_TTL_MS = 30 * 60 * 1000; // сам фид на стороне gdeslon обновляется не чаще раза в сутки
// Сколько офферов с живой картинкой набирать на КАЖДУЮ категорийную выгрузку.
const PER_FEED_LIMIT = Number(process.env.GDESLON_OFFER_LIMIT) || 3000;
// Сколько категорийных выгрузок обрабатывать одновременно — ограничиваем, чтобы параллельная
// закачка нескольких zip не забивала канал (см. бэкпрешер внутри fetchZippedOffers).
const FEED_CONCURRENCY = 3;
// Защитный потолок: сколько офферов максимум просканировать в поисках PER_FEED_LIMIT штук с живой
// картинкой на одной выгрузке, прежде чем сдаться и отдать что нашли.
const SCAN_LIMIT_MULTIPLIER = 30;
// Тот же защитный потолок, но по времени — на случай, если офферы с живой картинкой на фиде
// встречаются очень редко, а не просто идут кластерами.
const SCAN_TIME_BUDGET_MS = 45_000;
// Жёсткий потолок на одну выгрузку целиком (соединение + чтение потока), с запасом над бюджетом сканирования.
const FEED_HARD_TIMEOUT_MS = SCAN_TIME_BUDGET_MS + 15_000;
// Потолок на всё обновление каталога и пауза перед новой попыткой после сбоя/пустого результата —
// чтобы каждый запрос к /api/gift-offers не запускал заново тяжёлую сборку.
const REFRESH_TIMEOUT_MS = 12 * 60 * 1000;
const REFRESH_RETRY_DELAY_MS = 2 * 60 * 1000;
const IMAGE_CHECK_CONCURRENCY = 20;
const IMAGE_CHECK_TIMEOUT_MS = 4000;
let cache: { offers: GdeslonOffer[]; fetchedAt: number } | null = null;
// Сбор всех выгрузок занимает минуты (см. buildOffers) — обычный reverse-proxy (nginx) обрывает
// HTTP-запрос по таймауту (обычно 60с) задолго до этого. Поэтому запрос никогда не ждёт сборку:
// отдаём то, что уже в кэше (в холодном старте — пусто, клиент сам падает на моковую подборку,
// см. IdeaSwipeStack.tsx), а обновление гоним в фоне. refreshPromise защищает от того, чтобы
// несколько одновременных запросов не запускали сборку заново каждый.
let refreshPromise: Promise<void> | null = null;
let nextRefreshAt = 0;

function extractTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return match ? decodeXmlEntities(match[1]).trim() : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Извлекает завершённые <offer>...</offer> блоки из xml и возвращает офферы вместе с остатком
// строки после последнего полного блока — чтобы вызывающий код мог продолжить с него при
// поступлении следующего куска потока.
function parseOffers(xml: string): { offers: GdeslonOffer[]; rest: string } {
  const offers: GdeslonOffer[] = [];
  const blockRe = /<offer\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/offer>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(xml))) {
    const [, id, body] = match;
    lastIndex = blockRe.lastIndex;
    const url = extractTag(body, 'url');
    const title = extractTag(body, 'name') || extractTag(body, 'model');
    const originalPicture = extractTag(body, 'original_picture') || null;
    const proxyPicture = extractTag(body, 'picture');
    const imageUrl = originalPicture || (proxyPicture ? (proxyPicture.startsWith('//') ? `https:${proxyPicture}` : proxyPicture) : null);
    if (!url || !title || !imageUrl) continue; // карточкам "Идей" нужна фотография — без неё пропускаем
    const priceRaw = extractTag(body, 'price');
    const price = priceRaw != null ? Number(priceRaw.replace(',', '.')) : null;
    offers.push({
      id,
      title: title.slice(0, 200),
      url,
      imageUrl,
      price: Number.isFinite(price) ? price : null,
      currency: extractTag(body, 'currencyId'),
    });
  }
  return { offers, rest: xml.slice(lastIndex) };
}

async function hasLiveImage(imageUrl: string | null): Promise<boolean> {
  if (!imageUrl) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, { method: 'HEAD', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildOffers(): Promise<GdeslonOffer[]> {
  const singleFeedUrl = process.env.GDESLON_FEED_URL;
  return singleFeedUrl ? fetchFeedOffers(singleFeedUrl, PER_FEED_LIMIT) : fetchAllCategoryFeeds();
}

function scheduleRefresh(): void {
  if (refreshPromise || Date.now() < nextRefreshAt) return; // сборка уже идёт или ждём паузу после сбоя
  let refreshTimer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    refreshTimer = setTimeout(() => reject(new Error(`gdeslon refresh timed out after ${REFRESH_TIMEOUT_MS} ms`)), REFRESH_TIMEOUT_MS);
  });
  refreshPromise = Promise.race([buildOffers(), timeout])
    .then((offers) => {
      // Пустой результат (все выгрузки упали) не затирает прежний кэш и повторяется после паузы
      if (offers.length === 0) throw new Error('gdeslon refresh returned no offers');
      cache = { offers, fetchedAt: Date.now() };
      nextRefreshAt = 0;
    })
    .catch((error) => {
      console.error('gdeslon offers refresh failed:', error);
      nextRefreshAt = Date.now() + REFRESH_RETRY_DELAY_MS;
    })
    .finally(() => {
      clearTimeout(refreshTimer);
      refreshPromise = null;
    });
}

// GDESLON_FEED_URL — если задан, переопределяет весь набор категорийных выгрузок одной сквозной
// (для локальной отладки/старого сценария). Без него и без GDESLON_FEED_URL используются
// CATEGORY_FEEDS. Без обоих вкладка "Идеи" остаётся на статичном моке (см. giftIdeas.ts).
//
// Не блокирует вызывающий код: сразу возвращает то, что есть в кэше (может быть пустым списком на
// холодном старте), и при необходимости запускает обновление в фоне — см. комментарий у refreshPromise.
export function getGdeslonOffers(): GdeslonOffer[] {
  if (!process.env.GDESLON_FEED_URL && CATEGORY_FEEDS.length === 0) return [];
  if (!cache || Date.now() - cache.fetchedAt >= CACHE_TTL_MS) scheduleRefresh();
  return cache?.offers ?? [];
}

// Прогревает кэш сразу при старте сервера, чтобы не отдавать пустой список первому же
// реальному запросу после деплоя/рестарта.
export function warmGdeslonCache(): void {
  scheduleRefresh();
}

async function fetchAllCategoryFeeds(): Promise<GdeslonOffer[]> {
  const seen = new Set<string>();
  const merged: GdeslonOffer[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < CATEGORY_FEEDS.length) {
      const feed = CATEGORY_FEEDS[cursor++];
      let offers: GdeslonOffer[];
      try {
        offers = await fetchFeedOffers(feed.url, PER_FEED_LIMIT);
      } catch (error) {
        // Один сбой сети (DNS/сокет) не должен стоить всей категории — пробуем ещё раз
        console.warn(`gdeslon feed "${feed.category}" failed, retrying once:`, error);
        try {
          offers = await fetchFeedOffers(feed.url, PER_FEED_LIMIT);
        } catch (retryError) {
          console.error(`gdeslon feed "${feed.category}" failed again, skipping:`, retryError);
          continue;
        }
      }
      for (const offer of offers) {
        if (seen.has(offer.id)) continue; // один товар может попасть в несколько категорий
        seen.add(offer.id);
        merged.push(offer);
      }
    }
  }

  await Promise.all(Array.from({ length: FEED_CONCURRENCY }, worker));
  return merged;
}

function fetchFeedOffers(feedUrl: string, limit: number): Promise<GdeslonOffer[]> {
  return feedUrl.endsWith('.zip') ? fetchZippedOffers(feedUrl, limit) : fetchPlainOffers(feedUrl, limit);
}

async function fetchPlainOffers(feedUrl: string, limit: number): Promise<GdeslonOffer[]> {
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`gdeslon feed responded ${res.status}`);
  const xml = await res.text();
  const { offers } = parseOffers(xml);
  return scanForLiveOffers(offers.slice(0, limit * SCAN_LIMIT_MULTIPLIER), limit);
}

// Проверяет офферы на живую картинку с ограниченной параллельностью и останавливается, как
// только набрано limit штук (или список кандидатов исчерпан).
async function scanForLiveOffers(candidates: GdeslonOffer[], limit: number): Promise<GdeslonOffer[]> {
  const live: GdeslonOffer[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length && live.length < limit) {
      const offer = candidates[cursor++];
      if (await hasLiveImage(offer.imageUrl)) live.push(offer);
    }
  }
  await Promise.all(Array.from({ length: IMAGE_CHECK_CONCURRENCY }, worker));
  return live.slice(0, limit);
}

async function fetchZippedOffers(feedUrl: string, limit: number): Promise<GdeslonOffer[]> {
  const scanLimit = limit * SCAN_LIMIT_MULTIPLIER;
  const controller = new AbortController();
  let stopping = false;
  const deadline = Date.now() + SCAN_TIME_BUDGET_MS;

  function stopAll() {
    if (stopping) return;
    stopping = true;
    controller.abort();
  }

  // Жёсткий потолок на всю выгрузку (включая ожидание ответа): без него зависшее соединение или
  // поток, из которого не приходят офферы, держат сборку всего каталога бесконечно.
  const hardTimer = setTimeout(stopAll, FEED_HARD_TIMEOUT_MS);
  try {
    return await readZippedOffers(feedUrl, limit, scanLimit, controller, deadline, () => stopping, stopAll);
  } finally {
    clearTimeout(hardTimer);
  }
}

async function readZippedOffers(
  feedUrl: string,
  limit: number,
  scanLimit: number,
  controller: AbortController,
  deadline: number,
  isStopping: () => boolean,
  stopAll: () => void,
): Promise<GdeslonOffer[]> {
  const res = await fetch(feedUrl, { signal: controller.signal });
  if (!res.ok) throw new Error(`gdeslon feed responded ${res.status}`);
  if (!res.body) throw new Error('gdeslon feed response has no body');

  const decoder = new TextDecoder('utf-8');
  const pendingQueue: GdeslonOffer[] = []; // офферы, распарсенные из потока, но ещё не проверенные
  const live: GdeslonOffer[] = [];
  let pendingXml = '';
  let scanned = 0;
  let streamDone = false;
  // Разрешается при остановке: reader.read() после abort() у уже принятого ответа может не
  // завершиться никогда — гонкой с этим промисом главный цикл гарантированно выходит.
  const stopped = new Promise<{ value: undefined; done: true }>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve({ value: undefined, done: true }), { once: true });
  });

  const unzipper = new Unzip((file) => {
    if (!file.name.toLowerCase().endsWith('.xml')) return;
    file.ondata = (err, data, final) => {
      if (err || isStopping()) return;
      pendingXml += decoder.decode(data, { stream: !final });
      const { offers: found, rest } = parseOffers(pendingXml);
      pendingQueue.push(...found);
      pendingXml = rest;
    };
    file.start();
  });
  unzipper.register(UnzipInflate);

  // Воркеры разбирают очередь офферов параллельно, по мере того как поток их поставляет
  async function worker() {
    while (!isStopping()) {
      const offer = pendingQueue.shift();
      if (!offer) {
        if (streamDone) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
        continue;
      }
      scanned += 1;
      if (await hasLiveImage(offer.imageUrl)) {
        live.push(offer);
        if (live.length >= limit) {
          stopAll();
          return;
        }
      }
      if (scanned >= scanLimit || Date.now() >= deadline) {
        stopAll();
        return;
      }
    }
  }
  const workersDone = Promise.all(Array.from({ length: IMAGE_CHECK_CONCURRENCY }, worker));

  // Без бэкпрешера скачивание zip (гигабайты на сквозной выгрузке) забивает канал и конкурентные
  // HEAD-проверки картинок начинают ложно таймаутить от нехватки полосы — поэтому придерживаем
  // чтение потока, пока воркеры не разберут скопившуюся очередь.
  const MAX_QUEUE = IMAGE_CHECK_CONCURRENCY * 3;
  const reader = res.body.getReader();
  try {
    while (!isStopping()) {
      while (pendingQueue.length > MAX_QUEUE && !isStopping()) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (isStopping()) break;
      const { value, done } = await Promise.race([reader.read(), stopped]);
      if (isStopping()) break;
      if (done) {
        unzipper.push(new Uint8Array(0), true);
        break;
      }
      unzipper.push(value, false);
    }
  } catch (error) {
    if (!isStopping()) throw error;
  } finally {
    streamDone = true;
    reader.cancel().catch(() => {});
  }

  await workersDone;
  return live.slice(0, limit);
}
