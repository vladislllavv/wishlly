import type { Request, Response } from 'express';
import { getTakprodamOffers } from '../takprodam.js';

// Отдаёт каталог для вкладки "Идеи": реальные товары с партнёрскими ссылками Такпродам.
// Синхронно (не ждёт обновление — то идёт в фоне, см. takprodam.js). Если кэш ещё не прогрелся
// или токен/id площадки не настроены — пустой список, фронтенд сам падает на мок-подборку.
export function handleGiftOffers(_req: Request, res: Response) {
  try {
    res.json({ offers: getTakprodamOffers() });
  } catch (error) {
    console.error('gift-offers error:', error);
    res.json({ offers: [] });
  }
}
