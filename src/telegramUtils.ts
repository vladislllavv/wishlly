import type React from 'react';
import type { GuestView } from './types';

// Telegram передаёт параметры запуска в хэше URL (#tgWebAppData=...&tgWebAppStartParam=...)
export function getTelegramLaunchParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.slice(1));
}

// initData берём из SDK, а если telegram-web-app.js не успел загрузиться (медленная сеть) — из хэша URL.
// Иначе приложение приняло бы Telegram за обычный браузер и ушло в анонимный вход.
export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData || getTelegramLaunchParams().get('tgWebAppData') || '';
}

// start_param из ссылки «Поделиться»: "<uid>" или "<uid>-<groupId>".
// Разделитель "-": uid вида tg_123 содержит "_", а id документов Firestore и uid не содержат "-".
export function parseStartParam(): GuestView | null {
  const tg = window.Telegram?.WebApp;
  const raw =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(window.location.search).get('tgWebAppStartParam') ||
    getTelegramLaunchParams().get('tgWebAppStartParam') ||
    new URLSearchParams(getTelegramInitData()).get('start_param');
  if (!raw || !/^[A-Za-z0-9_-]{1,64}$/.test(raw)) return null;
  const [ownerId, groupId] = raw.split('-');
  return ownerId ? { ownerId, groupId: groupId || null } : null;
}

// Атрибут inert (React 18 его не знает в типах): блокирует фокус и клики внутри закрытых, но отрисованных шитов
export function inertWhen(condition: boolean): Record<string, unknown> {
  return condition ? { inert: '' } : {};
}

// Элементы внутри окна, до которых можно дойти клавишей Tab (видимые, не disabled, не внутри inert)
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !(el as HTMLButtonElement).disabled && !el.closest('[inert]') && el.getClientRects().length > 0);
}

// Методы Mini App API доступны не во всех версиях клиента — проверяем перед вызовом
export function tgSupports(version: string): boolean {
  const tg = window.Telegram?.WebApp;
  return !!tg?.isVersionAtLeast?.(version);
}

// Ссылки открываем средствами Telegram, а не target="_blank" внутри webview
export function openExternal(e: React.MouseEvent, url: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    e.preventDefault();
    tg.openLink(url);
  }
}
