import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, signInWithCustomToken, type User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from './dataconnect-generated';

export type { FirebaseUser };

// Firebase Configuration & Initialization (значения берутся из .env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
// Не getAuth(): на Safari/iOS/мобильных он при старте ждёт apis.google.com/js/api.js и iframe *.firebaseapp.com
// (для входа через popup/redirect, которого у нас нет), и первый onAuthStateChanged задерживается
// на время их загрузки — в сетях с медленным доступом к Google это секунды.
export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  } catch {
    return getAuth(app); // уже инициализирован (например, при hot reload)
  }
})();
// Локальный кэш в IndexedDB: при повторном открытии данные показываются сразу, до ответа сервера.
// AutoDetectLongPolling — если сеть режет WebChannel-стрим, Firestore быстро переключается на long-polling
// вместо долгого ожидания таймаута.
// initializeFirestore здесь на верхнем уровне модуля — если он бросит исключение, main.tsx не успеет
// вызвать render(), и приложение зависнет на статической заставке из index.html без единой ошибки на
// экране (только в консоли вебвью, которую пользователь не видит). persistentLocalCache открывает
// IndexedDB синхронно, а в некоторых встроенных вебвью (напр. десктопный Telegram на macOS открывает
// Mini App в изолированном/эфемерном хранилище) IndexedDB бывает недоступен — поэтому, как и для auth
// выше, оборачиваем в try/catch и откатываемся на кэш в памяти.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalAutoDetectLongPolling: true,
    });
  } catch (error) {
    console.warn('Firestore persistent cache unavailable, falling back to memory cache:', error);
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
})();
export const appId = import.meta.env.VITE_APP_ID || 'wishforyou-tma-id';
export const botUsername = import.meta.env.VITE_BOT_USERNAME || 'wishlly_bot';
// Postgres-коннектор «ideas»: анонимизированные желания пользователей (shareToIdeas), показанные
// во вкладке «Идеи» другим — отдельная БД от Firestore выше, см. dataconnect/schema/ideas.gql.
// npm run dev:mock подменяет firebase/app заглушкой (initializeApp возвращает {}), а firebase/data-connect
// не мокается — getDataConnect() с пустым app падает на реальный getApp(), которого в этом режиме
// нет. Как и для auth/db выше, оборачиваем в try/catch: без живого Data Connect вкладка «Идеи»
// просто не подмешивает чужие желания (см. IdeaSwipeStack.tsx), а не роняет весь рендер.
export const dataConnect = (() => {
  try {
    return getDataConnect(app, connectorConfig);
  } catch (error) {
    console.warn('Data Connect unavailable, community ideas in "Идеи" will be skipped:', error);
    return null;
  }
})();

// Обменивает подписанный Telegram initData на Firebase custom token (см. api/auth.ts)
async function fetchTelegramAuthToken(initData: string): Promise<string> {
  // Без таймаута зависший запрос оставлял бы пользователя на вечной загрузке
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
      signal: controller.signal,
    });
    if (!res.ok) throw Object.assign(new Error(`Auth request failed: ${res.status}`), { status: res.status });
    const { token } = await res.json();
    return token;
  } finally {
    clearTimeout(timer);
  }
}

// Временные сбои (сеть, таймаут, 5xx, рассинхрон часов сервера) — стоит повторить; 400/401 — нет
function isTransientAuthError(error: any): boolean {
  if (error?.name === 'AbortError' || error instanceof TypeError) return true;
  if (typeof error?.status === 'number') return error.status >= 500;
  return ['auth/network-request-failed', 'auth/internal-error', 'auth/invalid-custom-token'].includes(error?.code);
}

const AUTH_RETRY_DELAYS_MS = [1000, 2500];
// На общий бюджет, а не только на fetch: auth.authStateReady()/signInWithCustomToken сами по себе
// не ограничены по времени и могут зависнуть (напр. второй Telegram-аккаунт на том же устройстве
// делит с первым IndexedDB вкладки, и её открытие встаёт в blocked-ожидание навсегда).
const AUTH_TOTAL_TIMEOUT_MS = 15000;

async function signInWithTelegramUnbounded(initData: string): Promise<void> {
  // Сессия Firebase хранится в IndexedDB. Если она уже принадлежит этому Telegram-пользователю,
  // повторный обмен initData на токен не нужен: экономим запрос к серверу и не зависим от его доступности.
  try {
    const tgId = JSON.parse(new URLSearchParams(initData).get('user') || 'null')?.id;
    await auth.authStateReady();
    if (tgId && auth.currentUser?.uid === `tg_${tgId}`) return;
  } catch { /* не удалось прочитать сессию — входим обычным путём */ }

  for (let attempt = 0; ; attempt++) {
    try {
      await signInWithCustomToken(auth, await fetchTelegramAuthToken(initData));
      return;
    } catch (error) {
      if (attempt >= AUTH_RETRY_DELAYS_MS.length || !isTransientAuthError(error)) throw error;
      console.warn(`Auth attempt ${attempt + 1} failed, retrying:`, error);
      await new Promise(resolve => setTimeout(resolve, AUTH_RETRY_DELAYS_MS[attempt]));
    }
  }
}

export async function signInWithTelegram(initData: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Telegram auth timed out'), { code: 'auth/timeout' })), AUTH_TOTAL_TIMEOUT_MS);
  });
  try {
    await Promise.race([signInWithTelegramUnbounded(initData), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// Короткий код для экрана ошибки — чтобы можно было понять причину без консоли
export function describeAuthError(error: any): string {
  if (error?.code) return String(error.code);
  if (typeof error?.status === 'number') return `http-${error.status}`;
  return error?.name || 'unknown';
}
