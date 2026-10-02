import { test, expect } from '@playwright/test';

// Раздел «Идеи» временно заменён заглушкой (прежний источник товаров, gdeslon, убран) —
// проверяем только, что вкладка открывается и показывает понятное сообщение, а не падает.

test('вкладка Идеи показывает заглушку «в разработке»', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Идеи' }).click();

  await expect(page.getByRole('heading', { name: 'Раздел в разработке' })).toBeVisible();
});
