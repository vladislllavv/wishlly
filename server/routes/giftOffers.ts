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
