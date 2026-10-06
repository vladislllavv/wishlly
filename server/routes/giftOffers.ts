import type { Request, Response } from 'express';
import { getTakprodamOffers, type TakprodamOffer } from '../takprodam.js';
import { getFeedProductsByInterests } from '../feedQuery.js';
import { curateFeedOffers } from '../feedCuration.js';

// Каталог интересов — 100 строк (src/interests.ts), так что длиннее запрос быть не может;
// обрезаем, а не отклоняем — это неопасный, самостоятельно восстановимый случай, а не атака.
const MAX_INTERESTS = 100;

function parseInterests(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_INTERESTS);
}

// Сколько id просмотренных товаров принимаем за раз — с запасом под долгую сессию свайпов,
// но не безгранично (строка в query string, не тело запроса).
const MAX_SEEN_IDS = 2000;

function parseSeenIds(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_SEEN_IDS);
}

// Без таймаута зависший Data Connect (сеть, просроченный SQL-триал, неотвечающий сервис) держал
// бы запрос вместо отката на полный список — та же причина, что у таймаута в fetchTelegramAuthToken
// (src/firebaseClient.ts).
const INTEREST_QUERY_TIMEOUT_MS = 2000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`gift-offers interest query timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

// Отдаёт каталог для вкладки "Идеи". С непустым interests сперва пробует SQL-слой
// тегированных товаров (server/feedMirror.ts); без совпадений, без параметра, по таймауту,
// или при любой другой ошибке Data Connect — тот же полный список из кэша Такпродам, что и
// раньше. `filtered: true` сообщает фронту, что офферы уже отобраны по интересам на сервере
// и повторно фильтровать их по substring (pickOffersForInterests, см. src/giftIdeas.ts) не нужно.
//
// В обоих случаях список дополнительно прогоняется через curateFeedOffers (см. feedCuration.ts):
// убирает дешёвку, мусорные категории по стоп-словам, дубли одной модели и уже просмотренное
// (?seen=id1,id2,...) — это чистит хлам (например, стельки), который раньше долетал до колоды.
export async function handleGiftOffers(
  req: Request,
  res: Response,
  queryByInterests: (interests: string[]) => Promise<TakprodamOffer[]> = getFeedProductsByInterests,
) {
  const query = req.query as Record<string, unknown> | undefined;
  const interests = parseInterests(query?.interests);
  const seenIds = parseSeenIds(query?.seen);

  if (interests.length > 0) {
    try {
      const matched = await withTimeout(queryByInterests(interests), INTEREST_QUERY_TIMEOUT_MS);
      if (matched.length > 0) {
        res.json({ offers: curateFeedOffers(matched, seenIds), filtered: true });
        return;
      }
    } catch (error) {
      console.error('gift-offers interest query failed, falling back to full feed:', error);
    }
  }
  try {
    res.json({ offers: curateFeedOffers(getTakprodamOffers(), seenIds), filtered: false });
  } catch (error) {
    console.error('gift-offers error:', error);
    res.json({ offers: [], filtered: false });
  }
}
