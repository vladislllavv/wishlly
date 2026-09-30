import { test, expect } from '@playwright/test';

// В dev:mock сервер /api/gift-offers недоступен (Express не поднят), поэтому колода строится
// на моковом каталоге (giftIdeas.ts), отфильтрованном по сид-интересам профиля
// (Фотография, Йога, Парфюмерия) — этого достаточно, чтобы проверить сам механизм свайпа.

test('вкладка Идеи показывает карточку и свайп вправо убирает её из колоды', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Идеи' }).click();

  await expect(page.getByRole('heading', { name: 'Идеи' })).toBeVisible();
  const card = page.locator('[data-swipe-card]');
  await expect(card).toBeVisible();
  const firstTitle = await card.locator('h3').textContent();

  await page.getByRole('button', { name: /^Хочу:/ }).click();
  await page.waitForTimeout(300); // анимация ухода карточки (200ms) + запас

  const nextCard = page.locator('[data-swipe-card]');
  if (await nextCard.count() > 0) {
    const nextTitle = await nextCard.locator('h3').textContent();
    expect(nextTitle).not.toBe(firstTitle);
  }
});
