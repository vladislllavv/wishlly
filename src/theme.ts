// Тема приложения: выбор пользователя (Авто/Светлая/Тёмная). «Авто» берёт тему Telegram (colorScheme),
// вне Telegram — системную. Палитра тёмной темы задана в index.css через [data-theme='dark'].
// Ту же логику в упрощённом виде повторяет скрипт в index.html — чтобы заставка не мигала.

type Scheme = 'light' | 'dark';
export type ThemePreference = 'auto' | Scheme;

const STORAGE_KEY = 'wishlly-theme';

// Должны совпадать с --color-app в index.css
const APP_BG: Record<Scheme, string> = { light: '#fafafc', dark: '#0e0e10' };

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch { /* localStorage может быть недоступен */ }
  return 'auto';
}

function currentScheme(): Scheme {
  const preference = getThemePreference();
  if (preference !== 'auto') return preference;
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

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch { /* выбор применится, но не сохранится */ }
  applyTheme();
}

export function initTheme() {
  applyTheme();
  window.Telegram?.WebApp?.onEvent?.('themeChanged', applyTheme);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
}
