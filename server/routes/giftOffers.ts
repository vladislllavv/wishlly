import type { Request, Response } from 'express';
import { fetchGdeslonOffers } from '../gdeslon.js';

// Отдаёт каталог для вкладки "Идеи": реальные товары с партнёрскими ссылками gdeslon.
// Если выгрузка ещё не настроена или недоступна — пустой список, фронтенд сам падает на мок.
export async function handleGiftOffers(_req: Request, res: Response) {
  try {
    const offers = await fetchGdeslonOffers();
    res.json({ offers });
  } catch (error) {
    console.error('gift-offers error:', error);
    res.json({ offers: [] });
  }
}
