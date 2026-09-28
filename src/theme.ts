// Тема приложения: светлая/тёмная берётся из Telegram (colorScheme), вне Telegram — из системы.
// Палитра тёмной темы задана в index.css через [data-theme='dark'].

type Scheme = 'light' | 'dark';

// Должны совпадать с --color-app в index.css
const APP_BG: Record<Scheme, string> = { light: '#fafafc', dark: '#0e0e10' };

function currentScheme(): Scheme {
  const scheme = window.Telegram?.WebApp?.colorScheme;
  if (scheme === 'dark' || scheme === 'light') return scheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
  const scheme = currentScheme();
  document.documentElement.dataset.theme = scheme;

  // Красим оболочку Telegram под фон приложения (методы есть не во всех версиях клиента)
  const tg = window.Telegram?.WebApp;
  if (!tg?.initData) return;
  const bg = APP_BG[scheme];
  if (tg.isVersionAtLeast?.('6.1')) tg.setBackgroundColor?.(bg);
  if (tg.isVersionAtLeast?.('6.9')) tg.setHeaderColor?.(bg);
  if (tg.isVersionAtLeast?.('7.10')) tg.setBottomBarColor?.(bg);
}

export function initTheme() {
  applyTheme();
  window.Telegram?.WebApp?.onEvent?.('themeChanged', applyTheme);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
}
