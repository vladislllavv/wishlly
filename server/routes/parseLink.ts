import type { Request, Response as ExpressResponse } from 'express';

// Автозаполнение формы желания по ссылке на товар: тянем schema.org/Product из ld+json
// (или og:/twitter:-метатеги, если ld+json нет) со страницы товара и, если нашлась картинка,
// сразу конвертируем её в base64 (тот же формат, что хранит Firestore).

const MAX_HTML_BYTES = 500_000; // больше не читаем — метатеги всегда в начале <head>
const MAX_IMAGE_BASE64_LENGTH = 850_000; // firestore.rules ограничивает imageUrl 900_000 символами
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 6;
const BROWSER_UA = 'Mozilla/5.0 (compatible; WishllyBot/1.0; +https://wishlly.ru)';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: 'follow', ...init, signal: controller.signal });
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
function pickMeta(html: string, names: string[]): string | null {
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
function extractJsonLdProduct(html: string): Record<string, any> | null {
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

function decodeEntities(value: string): string {
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
    console.error('parse-link error:', error);
    const isTimeout = error?.name === 'AbortError';
    res.status(isTimeout ? 504 : 500).json({ error: isTimeout ? 'Страница долго отвечает' : 'Не удалось получить данные' });
  }
}
