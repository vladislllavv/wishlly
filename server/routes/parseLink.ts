import type { Request, Response as ExpressResponse } from 'express';
import { lookup as dnsLookupCb, type LookupAddress } from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

// Автозаполнение формы желания по ссылке на товар: тянем schema.org/Product из ld+json
// (или og:/twitter:-метатеги, если ld+json нет) со страницы товара и, если нашлась картинка,
// сразу конвертируем её в base64 (тот же формат, что хранит Firestore).

const MAX_HTML_BYTES = 500_000; // больше не читаем — метатеги всегда в начале <head>
const MAX_IMAGE_BASE64_LENGTH = 850_000; // firestore.rules ограничивает imageUrl 900_000 символами
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 6;
const BROWSER_UA = 'Mozilla/5.0 (compatible; WishllyBot/1.0; +https://wishlly.ru)';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// SSRF guard: пользователь присылает произвольный URL, а мы делаем по нему server-side fetch
// (и повторяем это на каждом хопе редиректа) — без этой проверки страница/редирект могли бы
// указывать на 127.0.0.1, локальную сеть или 169.254.169.254 (метаданные облака) и сервер бы
// сходил туда со своими правами.
export function isPrivateOrReservedIp(address: string, family: number): boolean {
  if (family === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 0) return true; // "this" network
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  const lower = address.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('::ffff:')) return isPrivateOrReservedIp(lower.slice('::ffff:'.length), 4);
  return false;
}

async function assertPublicHttpUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('url must be http(s)');
  }
  const hostname = parsed.hostname;
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await dnsLookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateOrReservedIp(a.address, a.family))) {
    throw new Error('url resolves to a disallowed address');
  }
}

// Закреплённый (pinned) DNS-резолвинг для самого соединения: assertPublicHttpUrl() выше — это быстрая
// предварительная проверка для понятного сообщения об ошибке, но между ней и фактическим connect() у
// fetch() есть зазор, в котором DNS-рекорд домена (TTL=0) может смениться на приватный/служебный адрес
// (DNS rebinding) — обычный fetch() сам сделает повторный lookup и обойдёт проверку выше. Поэтому
// реальное соединение идёт через undici.Agent с кастомным connect.lookup: он резолвит хост сам и либо
// возвращает только проверенные публичные адреса, либо сразу роняет соединение — TOCTOU-окна не остаётся,
// потому что адрес, который проверили, и есть адрес, по которому пойдёт TCP-коннект.
function pinnedLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (err: NodeJS.ErrnoException | null, address: LookupAddress[] | string, family?: number) => void,
): void {
  dnsLookupCb(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) { callback(err, []); return; }
    const list = addresses as LookupAddress[];
    const safe = list.filter((a) => !isPrivateOrReservedIp(a.address, a.family));
    if (safe.length === 0) {
      callback(Object.assign(new Error('url resolves to a disallowed address'), { code: 'EDISALLOWEDADDR' }), []);
      return;
    }
    if (options.all) { callback(null, safe); return; }
    callback(null, safe[0].address, safe[0].family);
  });
}

const pinnedAgent = new Agent({ connect: { lookup: pinnedLookup } });

async function fetchWithTimeout(url: string, init: Omit<UndiciRequestInit, 'signal'> = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // undiciFetch, а не глобальный fetch: нужен, чтобы передать dispatcher с закреплённым
    // DNS-резолвингом — см. pinnedLookup выше.
    return await undiciFetch(url, {
      redirect: 'follow', ...init, signal: controller.signal as AbortSignal, dispatcher: pinnedAgent,
    }) as unknown as Response;
  } finally {
    clearTimeout(timer);
  }
}

// Некоторые сайты не сразу отдают страницу, а сначала редиректят с Set-Cookie
// (сессионная/анти-бот кука) и ждут её обратно в следующем запросе. fetch с redirect:'follow'
// такие куки не хранит между хопами, поэтому сайт редиректит по кругу, пока Node не бросит
// "redirect count exceeded". Следуем за редиректами сами и прокидываем куки вручную.
function mergeSetCookies(jar: Map<string, string>, res: Response): void {
  const setCookie = (res.headers as any).getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const pair = raw.split(';', 1)[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function fetchPageFollowingRedirects(url: string): Promise<Response> {
  const jar = new Map<string, string>();
  let currentUrl = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicHttpUrl(currentUrl);
    const res = await fetchWithTimeout(currentUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'ru,en;q=0.8',
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
    });
    mergeSetCookies(jar, res);
    const location = res.headers.get('location');
    if (!REDIRECT_STATUSES.has(res.status) || !location) return res;
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error('too many redirects');
}

// Ищем <meta property="X" content="Y"> в любом порядке атрибутов
export function pickMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'),
    ];
    for (const re of patterns) {
      const match = re.exec(html);
      if (match) return match[1];
    }
  }
  return null;
}

// Многие магазины для Google кладут в <script type="application/ld+json"> разметку schema.org/Product —
// там name/price идут "как есть", без пририсованных title/og:title маркетинговых хвостов вида
// "— купить в интернет-магазине X со скидкой". Она надёжнее og:title для настоящего названия и цены.
export function extractJsonLdProduct(html: string): Record<string, any> | null {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    let data: any;
    try {
      data = JSON.parse(script[1]);
    } catch {
      continue;
    }
    const candidates = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
    for (const item of candidates) {
      const types = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']];
      if (types.includes('Product')) return item;
    }
  }
  return null;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function readLimitedText(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  try {
    while (bytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return html;
}

async function fetchImageAsDataUrl(imageUrl: string, pageUrl: string): Promise<string | null> {
  try {
    const absolute = new URL(imageUrl, pageUrl).toString();
    if (!/^https?:\/\//i.test(absolute)) return null;
    await assertPublicHttpUrl(absolute);
    const res = await fetchWithTimeout(absolute, { headers: { 'User-Agent': BROWSER_UA } });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`;
    // Картинки без сжатия (в отличие от ручной загрузки, тут нет canvas) — пропускаем слишком большие,
    // чтобы не упереться в лимит firestore.rules на размер документа при сохранении желания.
    return dataUrl.length <= MAX_IMAGE_BASE64_LENGTH ? dataUrl : null;
  } catch (error) {
    console.warn('parse-link: image fetch failed:', error);
    return null;
  }
}

export async function handleParseLink(req: Request, res: ExpressResponse) {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'url must be http(s)' });
    return;
  }

  try {
    const pageRes = await fetchPageFollowingRedirects(url);
    if (!pageRes.ok) {
      res.status(502).json({ error: `Страница недоступна (${pageRes.status})` });
      return;
    }

    const html = await readLimitedText(pageRes);
    const product = extractJsonLdProduct(html);
    const offer = Array.isArray(product?.offers) ? product?.offers[0] : product?.offers;

    const ldName = typeof product?.name === 'string' ? product.name : null;
    const ogTitle = pickMeta(html, ['og:title', 'twitter:title']);
    const imageRaw =
      (Array.isArray(product?.image) ? product?.image[0] : product?.image) ||
      pickMeta(html, ['og:image:secure_url', 'og:image', 'twitter:image']);
    const priceRaw = offer?.price ?? pickMeta(html, ['product:price:amount', 'og:price:amount']);
    const currencyRaw = offer?.priceCurrency ?? pickMeta(html, ['product:price:currency', 'og:price:currency']);
    const descriptionRaw =
      (typeof product?.description === 'string' ? product.description : null) ??
      pickMeta(html, ['og:description', 'description', 'twitter:description']);
    // Тег <title> есть на любой странице, включая антибот-заглушки и экраны "идёт проверка устройства" —
    // такие страницы обычно сами перезагружаются через <meta http-equiv="refresh"> и не описывают себя
    // (нет ни картинки/цены, ни описания). Реальная страница — даже без og:-тегов, как у подарочных
    // сертификатов с произвольной суммой, — почти всегда имеет хотя бы meta description.
    const hasMetaRefresh = /<meta[^>]+http-equiv=["']refresh["']/i.test(html);
    const bareTitle = !hasMetaRefresh && (imageRaw || priceRaw || descriptionRaw)
      ? /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] || null
      : null;
    // ld+json name — самое чистое название (без "купить со скидкой в магазине X"), берём его первым
    const rawTitle = ldName || ogTitle || bareTitle;

    const imageUrl = imageRaw ? await fetchImageAsDataUrl(imageRaw, url) : null;
    const priceNumber = priceRaw != null ? Number(String(priceRaw).replace(',', '.')) : null;

    res.json({
      title: rawTitle ? decodeEntities(rawTitle).trim().slice(0, 200) : null,
      imageUrl,
      price: Number.isFinite(priceNumber) ? priceNumber : null,
      currency: currencyRaw ? String(currencyRaw).toUpperCase() : null,
      note: descriptionRaw ? decodeEntities(String(descriptionRaw)).trim().slice(0, 500) : null,
    });
  } catch (error: any) {
    const isTimeout = error?.name === 'AbortError';
    const isBlockedAddress = error?.message === 'url resolves to a disallowed address' || error?.message === 'url must be http(s)';
    if (!isBlockedAddress) console.error('parse-link error:', error);
    if (isBlockedAddress) {
      res.status(400).json({ error: 'Ссылка недоступна для обработки' });
      return;
    }
    res.status(isTimeout ? 504 : 500).json({ error: isTimeout ? 'Страница долго отвечает' : 'Не удалось получить данные' });
  }
}
