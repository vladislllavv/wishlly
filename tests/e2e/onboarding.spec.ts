import { test, expect } from '@playwright/test';

// Регрессия к изменениям в App.tsx (обязательный шаг интересов в онбординге): пользователь
// с уже существующим профилем (сид ME в dev/firebase-mock.ts, onboardingCompleted: true) не
// должен снова увидеть экран онбординга.

test('пользователь с готовым профилем не видит онбординг повторно', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Добро пожаловать в WISHLLY')).toHaveCount(0);
  await expect(page.getByText('Что вам интересно?')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
});
