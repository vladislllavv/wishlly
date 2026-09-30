import type { Request, Response } from 'express';
import { getGdeslonOffers } from '../gdeslon.js';

// Отдаёт каталог для вкладки "Идеи": реальные товары с партнёрскими ссылками gdeslon.
// Синхронно (не ждёт сборку выгрузок — та идёт в фоне, см. gdeslon.ts). Если выгрузка ещё не
// настроена, недоступна или кэш ещё не прогрелся — пустой список, фронтенд сам падает на мок.
export function handleGiftOffers(_req: Request, res: Response) {
  try {
    res.json({ offers: getGdeslonOffers() });
  } catch (error) {
    console.error('gift-offers error:', error);
    res.json({ offers: [] });
  }
}
