import { test, expect } from '@playwright/test';

// Прогоняется против dev:mock (см. playwright.config.ts) — профиль уже онбордингнут
// (dev/firebase-mock.ts), поэтому главный экран открывается сразу, без онбординга.

test('главная показывает сид-желания и позволяет добавить новое', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Беспроводные наушники Sony WH-1000XM5')).toBeVisible();
  await expect(page.getByText('Книга «Атомные привычки»')).toBeVisible();

  await page.getByRole('button', { name: 'Добавить желание' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новое желание' });
  await expect(dialog).toBeVisible();

  const title = `Тестовое желание ${Date.now()}`;
  await dialog.getByLabel('Название желания').fill(title);
  await dialog.getByRole('button', { name: 'Сохранить в вишлист' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(title)).toBeVisible();
});
