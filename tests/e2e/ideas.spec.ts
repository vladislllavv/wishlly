import { test, expect } from '@playwright/test';

// Прогоняется против dev:mock — реального сервера (и значит /api/gift-offers) нет, поэтому
// компонент сам падает на мок-каталог (см. src/giftIdeas.ts). Достаточно проверить, что колода
// рендерится и не падает, а не какая именно карточка выпала (порядок перемешан).

test('вкладка Идеи показывает колоду свайпов', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Идеи' }).click();

  await expect(page.getByRole('heading', { name: 'Идеи' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Хочу:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Не хочу:/ })).toBeVisible();
});
