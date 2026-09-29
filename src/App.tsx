import React, { useState, useEffect, useRef } from 'react';
import { 
  Gift, PlusCircle, Home, ExternalLink, CheckCircle, 
  User, X, Link as LinkIcon,
  Tag, Heart, Sparkles, Loader2, Trash2,
  Camera, XCircle, Folder, Calendar, ArrowRight, ArrowLeft, Check, Share2, Pencil, Search, Copy, FolderInput
} from 'lucide-react';
import { INTEREST_CATEGORIES, normalizeSearch } from './interests';
import IdeaSwipeStack from './components/IdeaSwipeStack';
import SwipeRow from './components/SwipeRow';
import { groupKey, GROUP_NAME_MAX } from './groupUtils';
import { getThemePreference, setThemePreference, type ThemePreference } from './theme';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, signInWithCustomToken, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, writeBatch, query, where } from 'firebase/firestore';

interface Wish {
  id: string;
  title: string;
  price?: string; // готовая строка для отображения, например «5 000 ₽» — считается из priceAmount/priceCurrency
  priceAmount?: number | null;
  priceCurrency?: string;
  link?: string;
  imageUrl?: string;
  note?: string;
  groupId?: string;
  ownerId: string;
  ownerName?: string;
  createdAt: number;
  // Кто забронировал — в отдельной коллекции reservations (см. firestore.rules), сюда не попадает:
  // владелец желания технически не может прочитать это поле даже из DevTools.
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: number;
}

export interface Profile {
  birthdate: string;
  gender: string;
  firstName?: string;
  interests?: string[];
  onboardingCompleted?: boolean;
  createdAt?: number;
}

interface GuestView {
  ownerId: string;
  groupId: string | null;
}

// Telegram передаёт параметры запуска в хэше URL (#tgWebAppData=...&tgWebAppStartParam=...)
function getTelegramLaunchParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.slice(1));
}

// initData берём из SDK, а если telegram-web-app.js не успел загрузиться (медленная сеть) — из хэша URL.
// Иначе приложение приняло бы Telegram за обычный браузер и ушло в анонимный вход.
function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData || getTelegramLaunchParams().get('tgWebAppData') || '';
}

// start_param из ссылки «Поделиться»: "<uid>" или "<uid>-<groupId>".
// Разделитель "-": uid вида tg_123 содержит "_", а id документов Firestore и uid не содержат "-".
function parseStartParam(): GuestView | null {
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

// Открываем только http(s)-ссылки — защита от javascript: и прочих схем
function isSafeLink(link?: string): boolean {
  return !!link && /^https?:\/\//i.test(link);
}

// Пользователь мог вставить ссылку с пробелами по краям или схемой в верхнем регистре ("HTTPS://…"):
// а правила Firestore проверяют `^https?://` с учётом регистра — поэтому обрезаем пробелы и приводим схему к нижнему
function normalizeLink(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, m => m.toLowerCase());
}

// Текст ошибки для поля «Ссылка» или null, если ссылка пуста (она необязательна) или корректна
function linkProblem(raw: string): string | null {
  const link = raw.trim();
  if (!link) return null;
  if (/\s/.test(link)) return 'В ссылке не должно быть пробелов';
  if (!/^https?:\/\/[^\s/]+/i.test(link)) return 'Ссылка должна начинаться с http:// или https://';
  return null;
}

// Понятная причина, почему не сработало автозаполнение. Сервер отдаёт `error` вроде «Страница недоступна (403)»,
// где в скобках — статус магазина; клиент раньше выбрасывал это и показывал один и тот же текст на всё
function describeParseLinkFailure(error: any): string {
  const manual = ' — заполните вручную';
  if (error?.name === 'AbortError' || error?.status === 504) return `Страница отвечает слишком долго${manual}`;
  if (error?.name === 'TypeError') return 'Нет связи с сервером. Проверьте интернет';
  if (error?.status === 400) return 'Проверьте ссылку: её не удалось открыть';
  if (error?.status === 502) {
    const upstream = Number(/\((\d{3})\)/.exec(String(error.serverMessage || ''))?.[1]);
    if ([401, 403, 429, 498].includes(upstream)) return `Магазин не отдаёт данные автоматически${manual}`;
    if (upstream === 404 || upstream === 410) return 'Страница не найдена. Проверьте ссылку';
    return `Страница недоступна${manual}`;
  }
  return `Не удалось получить данные по ссылке${manual}`;
}

// Атрибут inert (React 18 его не знает в типах): блокирует фокус и клики внутри закрытых, но отрисованных шитов
function inertWhen(condition: boolean): Record<string, unknown> {
  return condition ? { inert: '' } : {};
}

// Элементы внутри окна, до которых можно дойти клавишей Tab (видимые, не disabled, не внутри inert)
function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !(el as HTMLButtonElement).disabled && !el.closest('[inert]') && el.getClientRects().length > 0);
}

// Методы Mini App API доступны не во всех версиях клиента — проверяем перед вызовом
function tgSupports(version: string): boolean {
  const tg = window.Telegram?.WebApp;
  return !!tg?.isVersionAtLeast?.(version);
}

// Ссылки открываем средствами Telegram, а не target="_blank" внутри webview
function openExternal(e: React.MouseEvent, url: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    e.preventDefault();
    tg.openLink(url);
  }
}

// Вкладка «Рекомендации» скрыта, пока не готова (сейчас там заглушка «В разработке»)
const SHOW_RECOMMENDATIONS = true;

const NAV_TABS = [
  { id: 'home', label: 'Главная', Icon: Home },
  { id: 'reserved', label: 'Я дарю', Icon: Heart },
  ...(SHOW_RECOMMENDATIONS ? [{ id: 'recommendations', label: 'Идеи', Icon: Sparkles }] : []),
  { id: 'profile', label: 'Профиль', Icon: User },
];

const CURRENCY_OPTIONS = ['₽', '$', '€'] as const;

const EMPTY_WISH = { title: '', priceAmount: '', priceCurrency: '₽' as string, link: '', imageUrl: '', note: '', groupId: 'unassigned' };

// Собирает отображаемую строку цены из числа и валюты; пустая строка, если сумма не введена или некорректна
function formatPrice(amount: string, currency: string): string {
  const n = Number(amount.trim().replace(',', '.'));
  if (!amount.trim() || !Number.isFinite(n) || n < 0) return '';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

// Валюта из og:price:currency (ISO-код) в символ, принятый в форме
function currencyFromCode(code?: string | null): string | null {
  if (code === 'RUB') return '₽';
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return null;
}

const MIN_BIRTH_YEAR = 1900;

// Сегодняшняя дата в формате <input type="date"> (по местному времени, не UTC)
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Текст ошибки для даты рождения или null (пустое значение — не ошибка, его объясняет подсказка у кнопки)
function birthdateProblem(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Проверьте дату';
  if (Number(value.slice(0, 4)) < MIN_BIRTH_YEAR) return `Укажите год не раньше ${MIN_BIRTH_YEAR}`;
  if (value > todayISO()) return 'Дата рождения не может быть в будущем';
  return null;
}

// 'YYYY-MM-DD' → '14.11.1998'. Разбираем вручную: new Date('YYYY-MM-DD') считает дату в UTC
// и западнее Гринвича показал бы предыдущий день
function formatBirthdate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}

// Дней до ближайшего дня рождения; birthdate — 'YYYY-MM-DD' (значение <input type="date">)
function daysUntilBirthday(birthdate?: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate || '');
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), month, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month, day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function birthdayLabel(days: number): string {
  if (days === 0) return 'Сегодня день рождения! 🎉';
  if (days === 1) return 'День рождения завтра 🎂';
  return `День рождения через ${days} дн. 🎂`;
}

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
const auth = (() => {
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
const botUsername = import.meta.env.VITE_BOT_USERNAME || 'wishlly_bot';

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

async function signInWithTelegram(initData: string): Promise<void> {
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

// Короткий код для экрана ошибки — чтобы можно было понять причину без консоли
function describeAuthError(error: any): string {
  if (error?.code) return String(error.code);
  if (typeof error?.status === 'number') return `http-${error.status}`;
  return error?.name || 'unknown';
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tgUser, setTgUser] = useState<any>(null); // Telegram User Data
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [reservedWishes, setReservedWishes] = useState<Wish[]>([]); // брони текущего пользователя в любых вишлистах
  // Кто забронировал желания просматриваемого владельца — только в режиме гостя (свой список эту карту не запрашивает,
  // и правила Firestore всё равно не отдадут её владельцу — см. match /reservations/ в firestore.rules)
  const [reservationsByWishId, setReservationsByWishId] = useState<Record<string, string | null>>({});
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'reserved', 'profile'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [authErrorCode, setAuthErrorCode] = useState('');
  const [isSlowLoad, setIsSlowLoad] = useState(false); // загрузка затянулась — покажем подсказку

  // Guest mode: просмотр чужого вишлиста по ссылке «Поделиться»
  const [guestView, setGuestView] = useState<GuestView | null>(parseStartParam);

  // Profile & Onboarding State
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null); // профиль владельца в режиме гостя
  // 'missing' — профиля с таким id нет вообще: ссылка устарела или неверна (профиль есть у каждого, кто прошёл онбординг)
  const [ownerProfileState, setOwnerProfileState] = useState<'loading' | 'found' | 'missing' | 'error'>('loading');
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({ birthdate: '', gender: 'Не указано' });

  // Form State
  const [newWish, setNewWish] = useState(EMPTY_WISH);
  const [editingWishId, setEditingWishId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkTouched, setLinkTouched] = useState(false);
  const initialWishRef = useRef(EMPTY_WISH);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const reserveInFlight = useRef(new Set<string>());
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isParsingLink, setIsParsingLink] = useState(false); // автозаполнение формы по ссылке (/api/parse-link)
  // Какие поля сейчас содержат данные именно из автозаполнения (а не введены вручную) — если да,
  // повторное автозаполнение по новой вставленной ссылке может их перезаписать, а не только пустые.
  const autoFilledRef = useRef({ title: false, imageUrl: false, priceAmount: false, note: false });

  // Groups State
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeFilter, setActiveFilter] = useState(guestView?.groupId || 'all');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const groupSubmitLock = useRef(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  // Действия с желанием (смахнули вправо или кнопки в деталке): перенести в другую группу / сделать копию
  const [actionWishId, setActionWishId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'move' | 'copy'>('move');
  // Подсказка про смахивание — один раз, пока её не закроют
  const [swipeHintVisible, setSwipeHintVisible] = useState(() => {
    try { return localStorage.getItem('wishlly-swipe-hint') !== 'dismissed'; } catch { return true; }
  });
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const [groupPickerQuery, setGroupPickerQuery] = useState('');
  const groupChipsRef = useRef<HTMLDivElement>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [onlyFree, setOnlyFree] = useState(false); // гость: скрыть занятые подарки

  // Интересы и тема (профиль)
  const [isInterestsOpen, setIsInterestsOpen] = useState(false);
  const [interestsDraft, setInterestsDraft] = useState<string[]>([]);
  const [interestsQuery, setInterestsQuery] = useState('');
  const [isSavingInterests, setIsSavingInterests] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference);

  // Share State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Wish Detail State
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null);

  // Пока не пришёл первый снапшот — показываем скелетоны, а не «Здесь пока пусто»
  const [wishesLoaded, setWishesLoaded] = useState(false);

  const showToast = (message: string, isError = false) => {
    clearTimeout(toastTimer.current);
    setToastMessage(message);
    setToastIsError(isError);
    toastTimer.current = setTimeout(() => setToastMessage(''), 3000);
    if (tgSupports('6.1')) window.Telegram.WebApp.HapticFeedback?.notificationOccurred(isError ? 'error' : 'success');
  };

  // Нативное подтверждение Telegram, в браузере — window.confirm
  const askConfirm = (message: string, onConfirm: () => void) => {
    const tg = window.Telegram?.WebApp;
    // showConfirm появился в Bot API 6.2; SDK-объект есть и в обычном браузере, но метод там кидает ошибку
    if (tg?.showConfirm && tgSupports('6.2')) {
      tg.showConfirm(message, (confirmed) => { if (confirmed) onConfirm(); });
    } else if (window.confirm(message)) {
      onConfirm();
    }
  };

  const openAddModal = () => {
    // Пустая группа → новое желание сразу попадает в неё
    const isRealGroup = !isGuest && groups.some(g => g.id === activeFilter);
    const initial = { ...EMPTY_WISH, groupId: isRealGroup ? activeFilter : 'unassigned' };
    setEditingWishId(null);
    autoFilledRef.current = { title: false, imageUrl: false, priceAmount: false, note: false };
    setNewWish(initial);
    initialWishRef.current = initial;
    setLinkTouched(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (wish: Wish) => {
    setEditingWishId(wish.id);
    setLinkTouched(false);
    autoFilledRef.current = { title: false, imageUrl: false, priceAmount: false, note: false };
    const initial = {
      title: wish.title,
      // Старые желания могли быть созданы до перехода на числовую цену — тогда поле просто пустое,
      // а старая строка price остаётся видна на карточке, пока её не пересохранят
      priceAmount: wish.priceAmount != null ? String(wish.priceAmount) : '',
      priceCurrency: wish.priceCurrency || '₽',
      link: wish.link || '',
      imageUrl: wish.imageUrl || '',
      note: wish.note || '',
      groupId: wish.groupId || 'unassigned',
    };
    setNewWish(initial);
    initialWishRef.current = initial;
    setSelectedWishId(null);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingWishId(null);
  };

  // Закрытие формы самим пользователем (фон, крестик, «Назад» в Telegram): если что-то введено или изменено —
  // спрашиваем, чтобы случайный тап по фону не стёр данные. Группу не учитываем: её выбор ничего не стоит
  const requestCloseAddModal = () => {
    const { groupId: _a, ...current } = newWish;
    const { groupId: _b, ...initial } = initialWishRef.current;
    if (JSON.stringify(current) === JSON.stringify(initial)) {
      closeAddModal();
      return;
    }
    askConfirm('Закрыть без сохранения? Введённые данные пропадут.', closeAddModal);
  };

  useEffect(() => {
    // 1. Initialize Telegram WebApp if available
    const initTelegram = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand(); // Expand to full screen in TG
        // Иначе свайп вниз по шторке или списку закрывает Mini App (Bot API 7.7+)
        if (tgSupports('7.7')) tg.disableVerticalSwipes?.();
        if (tg.initDataUnsafe?.user) {
          setTgUser(tg.initDataUnsafe.user);
        }
      }
    };
    initTelegram();

    // SDK мог не загрузиться, но Telegram всё равно передал пользователя в initData
    if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
      try {
        const rawUser = new URLSearchParams(getTelegramInitData()).get('user');
        if (rawUser) setTgUser(JSON.parse(rawUser));
      } catch { /* необязательно: имя просто не покажем */ }
    }

    // 2. Initialize Firebase Auth
    const initAuth = async () => {
      const initData = getTelegramInitData();
      try {
        if (initData) {
          // Внутри Telegram: стабильный uid вида tg_<id>, одинаковый на всех устройствах.
          // Без фолбэка на анонимный вход — иначе пользователь молча получит чужой пустой профиль.
          await signInWithTelegram(initData);
        } else {
          // Обычный браузер (локальная разработка)
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setAuthErrorCode(describeAuthError(error));
        setAuthError(true);
        setIsLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) console.info(`[wishlly] auth ready in ${Math.round(performance.now())} ms`);
      setUser(currentUser);
      if (currentUser) {
        setAuthError(false);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Чей вишлист показываем: владельца из ссылки (режим гостя) или свой
  const isGuest = !!user && !!guestView && guestView.ownerId !== user.uid;
  const viewedOwnerId = isGuest ? guestView.ownerId : user?.uid;

  const exitGuestMode = () => {
    setGuestView(null);
    setActiveFilter('all');
    setOnlyFree(false);
  };

  // Гость открыл ссылку на несуществующего владельца: профиля нет и желаний нет
  const ownerNotFound = isGuest && ownerProfileState === 'missing' && wishesLoaded && wishes.length === 0;

  // Открыть вишлист друга из списка «Я дарю»
  const openFriendWishlist = (ownerId: string) => {
    setSelectedWishId(null);
    setGuestView({ ownerId, groupId: null });
    setActiveFilter('all');
    setOnlyFree(false);
    setActiveTab('home');
  };

  // Желания и группы просматриваемого владельца (свои или чужие в режиме гостя)
  useEffect(() => {
    if (!user || !viewedOwnerId) return;

    const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');

    setWishesLoaded(false);
    setGroupsLoaded(false);
    const unsubscribeWishes = onSnapshot(query(wishesRef, where('ownerId', '==', viewedOwnerId)), (snapshot) => {
      const wishesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as Wish);
      // Sort newest first
      wishesData.sort((a, b) => b.createdAt - a.createdAt);
      setWishes(wishesData);
      setWishesLoaded(true);
      console.info(`[wishlly] wishes at ${Math.round(performance.now())} ms (${snapshot.metadata.fromCache ? 'cache' : 'server'})`);
    }, (error) => {
      console.error("Error fetching wishes:", error);
      setWishesLoaded(true);
      showToast('Не удалось загрузить желания', true);
    });

    const groupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'groups');
    const unsubscribeGroups = onSnapshot(query(groupsRef, where('ownerId', '==', viewedOwnerId)), (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as Group);
      groupsData.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setGroups(groupsData);
      setGroupsLoaded(true);
    }, (error) => {
      console.error("Error fetching groups:", error);
      setGroupsLoaded(true);
    });

    return () => {
      unsubscribeWishes();
      unsubscribeGroups();
    };
  }, [user, viewedOwnerId]);

  // Кто что забронировал у просматриваемого владельца — нужно только в режиме гостя (карточки друга);
  // для своего списка эту коллекцию не читаем: правила и не отдали бы, и владельцу это не нужно
  useEffect(() => {
    if (!user || !isGuest || !viewedOwnerId) {
      setReservationsByWishId({});
      return;
    }
    const reservationsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');
    return onSnapshot(
      query(reservationsRef, where('ownerId', '==', viewedOwnerId)),
      (snapshot) => {
        const map: Record<string, string | null> = {};
        snapshot.docs.forEach(d => { map[d.id] = (d.data() as { reservedBy: string | null }).reservedBy ?? null; });
        setReservationsByWishId(map);
      },
      (error) => console.error("Error fetching reservations map:", error)
    );
  }, [user, isGuest, viewedOwnerId]);

  // Свой профиль и свои брони не зависят от того, чей вишлист открыт
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as Profile);
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true); // Показывать онбординг, если профиль еще не создан
      }
    }, (error) => {
      console.error("Error fetching profile:", error);
    });

    // «Я дарю» — брони текущего пользователя в любых вишлистах. reservations не хранит карточку желания,
    // поэтому после каждого снапшота дозапрашиваем сами желания по id (getDoc, не подписка — их не так много)
    const reservationsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');
    const unsubscribeReserved = onSnapshot(
      query(reservationsRef, where('reservedBy', '==', user.uid)),
      async (snapshot) => {
        const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');
        const entries = await Promise.all(snapshot.docs.map(async (reservationDoc) => {
          const { wishId } = reservationDoc.data() as { wishId: string };
          try {
            const wishSnap = await getDoc(doc(wishesRef, wishId));
            return wishSnap.exists() ? ({ id: wishSnap.id, ...wishSnap.data() } as Wish) : null;
          } catch (error) {
            console.error("Error fetching reserved wish:", error);
            return null;
          }
        }));
        const data = entries.filter((w): w is Wish => !!w);
        data.sort((a, b) => b.createdAt - a.createdAt);
        setReservedWishes(data);
      },
      (error) => console.error("Error fetching reservations:", error)
    );

    return () => {
      unsubscribeProfile();
      unsubscribeReserved();
    };
  }, [user]);

  // Профиль владельца в режиме гостя: имя и дата рождения для баннера
  useEffect(() => {
    if (!user || !isGuest || !viewedOwnerId) {
      setOwnerProfile(null);
      setOwnerProfileState('loading');
      return;
    }
    setOwnerProfileState('loading');
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', viewedOwnerId);
    return onSnapshot(
      ref,
      (snap) => {
        setOwnerProfile(snap.exists() ? (snap.data() as Profile) : null);
        setOwnerProfileState(snap.exists() ? 'found' : 'missing');
      },
      (error) => {
        console.error("Error fetching owner profile:", error);
        setOwnerProfileState('error'); // сетевая/прав ошибка — не выдаём её за «вишлист не найден»
      }
    );
  }, [user, isGuest, viewedOwnerId]);

  // Выбранной группы нет (гость открыл ссылку на удалённую/неверную группу, или владелец удалил её, пока друг смотрит):
  // показываем весь вишлист вместо пустого экрана «В этой группе пока нет желаний»
  useEffect(() => {
    if (!groupsLoaded || activeFilter === 'all' || activeFilter === 'unassigned') return;
    if (groups.some(g => g.id === activeFilter)) return;
    setActiveFilter('all');
    if (isGuest) showToast('Эта группа больше недоступна — показан весь вишлист');
  }, [groupsLoaded, groups, activeFilter, isGuest]);

  // Имя из Telegram в профиле — чтобы гость видел его в баннере, а не брал из первого желания
  useEffect(() => {
    if (!user || !userProfile || !tgUser?.first_name) return;
    if (userProfile.firstName === tgUser.first_name) return;
    setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid),
      { firstName: tgUser.first_name },
      { merge: true }
    ).catch((error) => console.error("Error saving first name:", error));
  }, [user, userProfile, tgUser]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Сжимаем изображение, чтобы оно легко поместилось в БД
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Экспортируем в JPEG со средним качеством
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        autoFilledRef.current.imageUrl = false;
        setNewWish(prev => ({ ...prev, imageUrl: dataUrl }));
        setIsImageProcessing(false);
      };
      img.src = event.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCompleteOnboarding = async () => {
    if (!user || isSavingProfile) return;
    if (!onboardingForm.birthdate || birthdateProblem(onboardingForm.birthdate) || onboardingForm.gender === 'Не указано') return;
    setIsSavingProfile(true);
    try {
      const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
      await setDoc(profileRef, {
        birthdate: onboardingForm.birthdate,
        gender: onboardingForm.gender,
        firstName: tgUser?.first_name || '',
        onboardingCompleted: true,
        createdAt: Date.now()
      });
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      showToast('Не удалось сохранить профиль. Попробуйте ещё раз.', true);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Текст ошибки для названия группы или null. excludeId — своя же группа при переименовании
  const groupNameError = (name: string, excludeId?: string): string | null => {
    const key = groupKey(name);
    if (!key) return null;
    return groups.some(g => g.id !== excludeId && groupKey(g.name) === key) ? 'Группа с таким названием уже есть' : null;
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;
    if (groupNameError(newGroupName)) return;
    if (groupSubmitLock.current) return;
    groupSubmitLock.current = true;
    try {
      const groupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'groups');
      const created = await addDoc(groupsRef, {
        name: newGroupName.trim(),
        ownerId: user.uid,
        createdAt: Date.now()
      });
      // Группа создана из формы желания — сразу выбираем её
      if (isAddModalOpen) setNewWish(prev => ({ ...prev, groupId: created.id }));
      setNewGroupName('');
      setIsGroupModalOpen(false);
      showToast('Группа создана');
    } catch (error) {
      console.error("Error adding group:", error);
      showToast('Не удалось создать группу', true);
    } finally {
      groupSubmitLock.current = false;
    }
  };

  const handleDeleteGroup = (e, group: Group) => {
    e?.stopPropagation();
    if (!user) return;

    const doDelete = async () => {
      try {
        // Желания из удалённой группы остаются у владельца, просто теряют привязку к группе.
        // Один batch — либо всё применится, либо ничего.
        const batch = writeBatch(db);
        wishes
          .filter(w => w.groupId === group.id)
          .forEach(w => batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'wishes', w.id), { groupId: 'unassigned' }));
        batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'groups', group.id));
        await batch.commit();
        if (activeFilter === group.id) setActiveFilter('all');
        if (newWish.groupId === group.id) setNewWish(prev => ({ ...prev, groupId: 'unassigned' }));
        showToast('Группа удалена');
      } catch (error) {
        console.error("Error deleting group:", error);
        showToast('Не удалось удалить группу', true);
      }
    };

    askConfirm(`Удалить группу «${group.name}»? Желания останутся, но без группы.`, doDelete);
  };

  const handleRenameGroup = async (group: Group) => {
    const name = renameValue.trim();
    if (!name || !user) return;
    if (name === group.name) {
      setRenamingGroupId(null);
      return;
    }
    const duplicate = groupNameError(name, group.id);
    if (duplicate) {
      showToast(duplicate, true);
      return;
    }
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', group.id), { name });
      setRenamingGroupId(null);
      showToast('Группа переименована');
    } catch (error) {
      console.error("Error renaming group:", error);
      showToast('Не удалось переименовать группу', true);
    }
  };

  const handleAddWish = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newWish.title.trim() || !user) return;
    if (linkProblem(newWish.link)) {
      // Показываем ошибку под полем и ставим туда курсор — вместо общего «Не удалось сохранить»
      setLinkTouched(true);
      linkInputRef.current?.focus();
      return;
    }
    // state обновляется асинхронно — двойной тап / MainButton успевают запустить вторую отправку
    if (submitLock.current) return;
    submitLock.current = true;

    setIsSubmitting(true);
    try {
      const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');
      const fields = {
        title: newWish.title.trim(),
        price: formatPrice(newWish.priceAmount, newWish.priceCurrency),
        priceAmount: newWish.priceAmount.trim() ? Number(newWish.priceAmount.replace(',', '.')) : null,
        priceCurrency: newWish.priceCurrency,
        link: normalizeLink(newWish.link),
        imageUrl: newWish.imageUrl,
        note: newWish.note.trim(),
        groupId: newWish.groupId,
      };
      if (editingWishId) {
        // Правила разрешают владельцу менять всё, кроме ownerId — бронь здесь и не может быть, она в другой коллекции
        await updateDoc(doc(wishesRef, editingWishId), fields);
        showToast('Изменения сохранены');
      } else {
        await addDoc(wishesRef, {
          ...fields,
          ownerId: user.uid,
          ownerName: tgUser?.first_name || 'Anonymous', // Store TG name if available
          createdAt: Date.now()
        });
        showToast('Желание добавлено ✨');
      }
      setNewWish(EMPTY_WISH);
      closeAddModal();
    } catch (error) {
      console.error("Error saving wish:", error);
      showToast('Не удалось сохранить. Попробуйте ещё раз.', true);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  // isCurrentlyReservedByMe передаём явно: с тех пор как бронь переехала в reservations,
  // у самого объекта wish этого поля больше нет (иначе владелец мог бы прочитать его же из кэша)
  const toggleReserve = async (wish: Wish, isCurrentlyReservedByMe: boolean) => {
    if (!user || wish.ownerId === user.uid) return;
    if (reserveInFlight.current.has(wish.id)) return;
    reserveInFlight.current.add(wish.id);

    try {
      const reservationRef = doc(db, 'artifacts', appId, 'public', 'data', 'reservations', wish.id);
      await setDoc(reservationRef, {
        wishId: wish.id,
        ownerId: wish.ownerId,
        reservedBy: isCurrentlyReservedByMe ? null : user.uid,
        updatedAt: Date.now(),
      }, { merge: true });
      showToast(isCurrentlyReservedByMe ? 'Бронь снята' : 'Вы дарите это желание 🎁');
    } catch (error) {
      console.error("Error updating reservation:", error);
      showToast('Не удалось изменить бронь. Возможно, её уже заняли.', true);
    } finally {
      reserveInFlight.current.delete(wish.id);
    }
  };

  // Автозаполнение формы по ссылке: сервер тянет schema.org/Product (или og:-метатеги) страницы
  // и (если есть) картинку товара. Поле перезаписывается, если оно пустое или было заполнено предыдущим
  // автозаполнением (autoFilledRef) — так вторая вставленная ссылка не даёт «слипшихся» старых данных,
  // но то, что пользователь ввёл сам, не затирается.
  const handleParseLink = async () => {
    if (!isSafeLink(normalizeLink(newWish.link)) || linkProblem(newWish.link) || isParsingLink) return;
    setIsParsingLink(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/parse-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizeLink(newWish.link) }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw Object.assign(new Error(`status ${res.status}`), { status: res.status, serverMessage: body?.error });
      }
      const data: { title: string | null; imageUrl: string | null; price: number | null; currency: string | null; note: string | null } = await res.json();

      if (!data.title && !data.imageUrl && data.price == null && !data.note) {
        showToast('На странице не нашлось данных — заполните вручную', true);
        return;
      }

      // Поле, которое уже было заполнено предыдущим автозаполнением, при новой ссылке не просто
      // пропускаем — приводим к тому, что нашлось теперь (в т.ч. очищаем, если на новой странице
      // этого нет), иначе после смены ссылки на карточке остаются хвосты от прошлого товара.
      // Решение, какие поля трогать, и мутацию autoFilledRef делаем один раз здесь, СНАРУЖИ
      // updater-функции setNewWish — React в StrictMode вызывает такую функцию дважды, и мутация
      // ref внутри неё даёт на второй вызов уже изменённые флаги при том же старом prev.
      const auto = autoFilledRef.current;
      const fillTitle = !newWish.title.trim() || auto.title;
      const fillImage = !newWish.imageUrl || auto.imageUrl;
      const fillPrice = !newWish.priceAmount.trim() || auto.priceAmount;
      const fillNote = !newWish.note.trim() || auto.note;
      auto.title = fillTitle ? !!data.title : auto.title;
      auto.imageUrl = fillImage ? !!data.imageUrl : auto.imageUrl;
      auto.priceAmount = fillPrice ? data.price != null : auto.priceAmount;
      auto.note = fillNote ? !!data.note : auto.note;

      setNewWish(prev => ({
        ...prev,
        title: fillTitle ? (data.title || '') : prev.title,
        imageUrl: fillImage ? (data.imageUrl || '') : prev.imageUrl,
        priceAmount: fillPrice ? (data.price != null ? String(data.price) : '') : prev.priceAmount,
        priceCurrency: fillPrice && data.currency ? (currencyFromCode(data.currency) || prev.priceCurrency) : prev.priceCurrency,
        note: fillNote ? (data.note || '') : prev.note,
      }));
      showToast('Заполнено по ссылке ✨');
    } catch (error) {
      console.error("Error parsing link:", error);
      showToast(describeParseLinkFailure(error), true);
    } finally {
      clearTimeout(timer);
      setIsParsingLink(false);
    }
  };

  const deleteWish = (wish: Wish) => {
    if (!user) return;
    askConfirm(`Удалить желание «${wish.title}»?`, async () => {
      try {
        const wishRef = doc(db, 'artifacts', appId, 'public', 'data', 'wishes', wish.id);
        await deleteDoc(wishRef);
        setSelectedWishId(null);
        showToast('Желание удалено');
      } catch (error) {
        console.error("Error deleting wish:", error);
        showToast('Не удалось удалить желание', true);
      }
    });
  };

  const openWishActions = (wishId: string, mode: 'move' | 'copy' = 'move') => {
    setSelectedWishId(null);
    setActionMode(mode);
    setActionWishId(wishId);
  };

  const groupTitle = (groupId: string) => groupId === 'unassigned' ? 'Без группы' : groups.find(g => g.id === groupId)?.name || 'группу';

  // Перенос в другую группу — обычное обновление groupId (правила разрешают владельцу менять всё, кроме ownerId)
  const moveWish = async (wish: Wish, groupId: string) => {
    setActionWishId(null);
    if ((wish.groupId || 'unassigned') === groupId) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'wishes', wish.id), { groupId });
      showToast(`Перенесено: ${groupTitle(groupId)}`);
    } catch (error) {
      console.error("Error moving wish:", error);
      showToast('Не удалось перенести желание', true);
    }
  };

  // Копия: те же поля, новая запись. Бронь не копируется — она живёт в отдельной коллекции
  const duplicateWish = async (wish: Wish, groupId: string) => {
    if (!user) return;
    setActionWishId(null);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'wishes'), {
        title: wish.title,
        price: wish.price || '',
        priceAmount: wish.priceAmount ?? null,
        priceCurrency: wish.priceCurrency || '₽',
        link: wish.link || '',
        imageUrl: wish.imageUrl || '',
        note: wish.note || '',
        groupId,
        ownerId: user.uid,
        ownerName: tgUser?.first_name || wish.ownerName || 'Anonymous',
        createdAt: Date.now(),
      });
      showToast(`Копия создана: ${groupTitle(groupId)}`);
    } catch (error) {
      console.error("Error duplicating wish:", error);
      showToast('Не удалось создать копию', true);
    }
  };

  useEffect(() => {
    if (actionWishId && wishesLoaded && !wishes.some(w => w.id === actionWishId)) setActionWishId(null);
  }, [actionWishId, wishes, wishesLoaded]);

  const dismissSwipeHint = () => {
    setSwipeHintVisible(false);
    try { localStorage.setItem('wishlly-swipe-hint', 'dismissed'); } catch { /* localStorage может быть недоступен */ }
  };

  const openInterests = () => {
    setInterestsDraft(userProfile?.interests || []);
    setInterestsQuery('');
    setIsInterestsOpen(true);
  };

  const toggleInterest = (name: string) => {
    setInterestsDraft(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  const saveInterests = async () => {
    if (!user) return;
    setIsSavingInterests(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid),
        { interests: interestsDraft },
        { merge: true }
      );
      setIsInterestsOpen(false);
      showToast('Интересы сохранены');
    } catch (error) {
      console.error("Error saving interests:", error);
      showToast('Не удалось сохранить интересы', true);
    } finally {
      setIsSavingInterests(false);
    }
  };

  const handleThemeChange = (preference: ThemePreference) => {
    setThemePreference(preference);
    setThemePref(preference);
  };

  const handleShare = (groupId, groupName) => {
    if (!user) return;
    
    // Формируем deeplink ссылку (заглушка имени бота для примера)
    // Параметр startapp позволяет передать данные в бота (чей вишлист и какая группа)
    const botUrl = `https://t.me/${botUsername}/app?startapp=${user.uid}${groupId !== 'all' ? `-${groupId}` : ''}`;
    const text = groupId === 'all'
      ? `Привет! Посмотри мой вишлист ✨`
      : `Привет! Посмотри мой вишлист «${groupName}» ✨`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(text)}`;

    // В обычном браузере объект Telegram.WebApp есть, но initData пуст и share-ссылка просто уведёт со страницы
    if (window.Telegram?.WebApp?.initData && window.Telegram.WebApp.openTelegramLink) {
      // Открываем нативное окно выбора чатов Telegram
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      // Фолбэк для браузера: копируем в буфер обмена
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = `${text}\n${botUrl}`;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      try {
        document.execCommand('copy');
        showToast('Ссылка скопирована!');
      } catch (err) {
        console.error('Ошибка копирования', err);
        showToast('Не удалось скопировать ссылку', true);
      }
      document.body.removeChild(tempTextArea);
    }
    setIsShareModalOpen(false);
  };

  // При многих группах выбранная может оказаться за краем ряда — подкручиваем её в видимую область
  useEffect(() => {
    const chip = groupChipsRef.current?.querySelector<HTMLElement>('[data-active-chip="true"]');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeFilter, groups.length]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsSlowLoad(true), 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // ---- Нативные кнопки Telegram ----

  // BackButton закрывает самый верхний слой: модалки → гостевой режим → вкладку
  let backAction: (() => void) | null = null;
  if (showOnboarding && !isGuest) backAction = onboardingStep === 2 ? () => setOnboardingStep(1) : null;
  else if (actionWishId) backAction = () => setActionWishId(null);
  else if (isInterestsOpen) backAction = () => setIsInterestsOpen(false);
  else if (isGroupPickerOpen) backAction = () => setIsGroupPickerOpen(false);
  else if (isGroupModalOpen) backAction = () => setIsGroupModalOpen(false);
  else if (isManageGroupsOpen) backAction = () => { setIsManageGroupsOpen(false); setRenamingGroupId(null); };
  else if (selectedWishId) backAction = () => setSelectedWishId(null);
  else if (isShareModalOpen) backAction = () => setIsShareModalOpen(false);
  else if (isAddModalOpen) backAction = requestCloseAddModal;
  else if (isGuest) backAction = exitGuestMode;
  else if (activeTab !== 'home') backAction = () => setActiveTab('home');

  // ---- Управление фокусом в модалках ----
  // Открытие: запоминаем, откуда пришли, и переводим фокус в окно. Закрытие: возвращаем фокус на кнопку-«вызывателя».
  // Пока окно открыто, Tab ходит по кругу внутри него.
  const topOverlay = actionWishId ? 'wish-actions'
    : isInterestsOpen ? 'interests'
    : isGroupPickerOpen ? 'group-picker'
    : isGroupModalOpen ? 'group-create'
    : isManageGroupsOpen ? 'group-manage'
    : selectedWishId ? 'detail'
    : isShareModalOpen ? 'share'
    : isAddModalOpen ? 'add'
    : null;
  const openOverlayCount = [!!actionWishId, isInterestsOpen, isGroupPickerOpen, isGroupModalOpen, isManageGroupsOpen, !!selectedWishId, isShareModalOpen, isAddModalOpen].filter(Boolean).length;
  const focusTriggers = useRef<(HTMLElement | null)[]>([]);
  const topOverlayRef = useRef(topOverlay);
  topOverlayRef.current = topOverlay;

  // История фокуса: у нового окна автофокус (например, поле названия группы) срабатывает раньше эффекта,
  // поэтому «откуда пришли» берём не из document.activeElement, а из последнего элемента вне открывшегося окна
  const focusHistory = useRef<HTMLElement[]>([]);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLElement)) return;
      focusHistory.current = [...focusHistory.current.filter(el => el !== e.target), e.target].slice(-10);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    const triggers = focusTriggers.current;
    const topEl = topOverlay ? document.querySelector<HTMLElement>(`[data-overlay="${topOverlay}"]`) : null;
    while (triggers.length < openOverlayCount) {
      const fromHistory = [...focusHistory.current].reverse().find(el => el.isConnected && !(topEl && topEl.contains(el)) && el !== topEl);
      const current = document.activeElement;
      const fromActive = current instanceof HTMLElement && current !== document.body && !(topEl && topEl.contains(current)) ? current : null;
      triggers.push(fromHistory ?? fromActive);
    }
    let restore: HTMLElement | null = null;
    while (triggers.length > openOverlayCount) restore = triggers.pop() ?? null;

    if (restore?.isConnected) {
      restore.focus({ preventScroll: true });
      return;
    }
    if (!topOverlay) return;
    // rAF: шит только что смонтирован/начинает выезжать — фокусируем после первой отрисовки, без прокрутки
    const raf = requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-overlay="${topOverlay}"]`);
      if (!container || container.contains(document.activeElement)) return;
      // На тач-экране не фокусируем поле ввода — иначе сразу выскочит клавиатура: фокус на само окно (его имя озвучит скринридер)
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const items = focusableIn(container);
      const target = coarse ? container
        : items.find(e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) || items.find(e => e.getAttribute('aria-label') !== 'Закрыть') || container;
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [topOverlay, openOverlayCount]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !topOverlayRef.current) return;
      const container = document.querySelector<HTMLElement>(`[data-overlay="${topOverlayRef.current}"]`);
      if (!container) return;
      const items = focusableIn(container);
      if (items.length === 0) { e.preventDefault(); container.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && (active === first || active === container)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const backActionRef = useRef(backAction);
  backActionRef.current = backAction;
  const hasOpenOverlay = !!actionWishId || isInterestsOpen || isGroupPickerOpen || isGroupModalOpen || isManageGroupsOpen
    || !!selectedWishId || isShareModalOpen || isAddModalOpen;
  const hasOpenOverlayRef = useRef(hasOpenOverlay);
  hasOpenOverlayRef.current = hasOpenOverlay;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasOpenOverlayRef.current) backActionRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const hasBackAction = !!backAction;

  useEffect(() => {
    if (!tgSupports('6.1')) return;
    const bb = window.Telegram.WebApp.BackButton;
    const handler = () => backActionRef.current?.();
    bb.onClick(handler);
    return () => bb.offClick(handler);
  }, []);

  useEffect(() => {
    if (!tgSupports('6.1')) return;
    const bb = window.Telegram.WebApp.BackButton;
    if (hasBackAction) bb.show(); else bb.hide();
  }, [hasBackAction]);

  // MainButton вместо кнопки «Сохранить» в форме — только внутри Telegram
  const nativeMain = !!window.Telegram?.WebApp?.initData && tgSupports('6.1');
  const canSubmitWish = !!newWish.title.trim() && !isImageProcessing && !isSubmitting;
  const submitWishRef = useRef(handleAddWish);
  submitWishRef.current = handleAddWish;

  useEffect(() => {
    if (!nativeMain) return;
    const mb = window.Telegram.WebApp.MainButton;
    const handler = () => submitWishRef.current();
    mb.onClick(handler);
    return () => { mb.offClick(handler); mb.hide(); };
  }, [nativeMain]);

  useEffect(() => {
    if (!nativeMain) return;
    const mb = window.Telegram.WebApp.MainButton;
    if (!isAddModalOpen) {
      mb.hide();
      return;
    }
    mb.setParams({
      text: editingWishId ? 'Сохранить изменения' : 'Сохранить в вишлист',
      color: '#f43f5e',
      text_color: '#ffffff',
      is_active: canSubmitWish,
      is_visible: true,
    });
    if (isSubmitting) mb.showProgress(false); else mb.hideProgress();
  }, [nativeMain, isAddModalOpen, editingWishId, canSubmitWish, isSubmitting]);

  if (isLoading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center h-16 w-16">
            <div className="absolute inset-0 border-4 border-rose-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-rose-500 rounded-full border-t-transparent animate-spin"></div>
            <Gift className="h-6 w-6 text-rose-500 animate-pulse" />
          </div>
          <p className="text-gray-500 font-medium">Загрузка…</p>
          {isSlowLoad && (
            <p className="text-sm text-gray-500 text-center max-w-[260px]">
              Дольше обычного. Приложению нужен доступ к сервисам Google — проверьте соединение или VPN.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-app px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Не удалось войти</h2>
          <p className="text-gray-500 font-medium">Проверьте соединение и попробуйте ещё раз.</p>
          {authErrorCode && <p className="text-xs text-gray-500 font-mono">Код: {authErrorCode}</p>}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button px-8 py-3.5 shadow-lg shadow-pink-200/50 active:scale-[0.98] transition-all"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col h-dvh bg-app shadow-2xl relative overflow-hidden font-sans sm:border-x sm:border-gray-200 text-gray-900 selection:bg-rose-100">
      
      {/* Top Header (Glassmorphism) */}
      <header className="flex-none bg-white/80 backdrop-blur-xl border-b border-gray-100 px-5 sticky top-0 z-20 flex items-center justify-between pt-[calc(max(env(safe-area-inset-top),var(--tg-safe-area-inset-top,0px))+var(--tg-content-safe-area-inset-top,0px)+0.75rem)] pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-rose-500 to-pink-400 p-2 rounded-2xl shadow-sm shadow-rose-200">
            <Gift className="h-5 w-5 text-on-accent" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            WISHLLY
          </h1>
        </div>
        
        {!isGuest && (
          <button
            onClick={() => setIsShareModalOpen(true)}
            aria-label="Поделиться вишлистом"
            className="flex items-center gap-2 bg-rose-50 text-accent-text pl-3.5 pr-4 py-2.5 min-h-11 rounded-full border border-rose-100 text-sm font-bold hover:bg-rose-100 active:scale-95 transition-all"
          >
            <Share2 className="h-4 w-4" />
            Поделиться
          </button>
        )}
      </header>

      <main className="flex-grow overflow-y-auto overflow-x-hidden pb-32 pt-5 px-4 custom-scrollbar">
        {activeTab === 'home' && (
          <div className="space-y-4">

            {/* Guest banner: чужой вишлист, открытый по ссылке */}
            {isGuest && !ownerNotFound && (() => {
              const sharedGroup = guestView?.groupId ? groups.find(g => g.id === guestView.groupId) : null;
              const ownerName = ownerProfile?.firstName || wishes[0]?.ownerName;
              const daysToBirthday = daysUntilBirthday(ownerProfile?.birthdate);
              const reservedCount = wishes.filter(w => reservationsByWishId[w.id]).length;

              return (
                <div className="bg-rose-50 border border-rose-100 rounded-tile px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Вишлист друга</p>
                      <p className="font-bold text-gray-900 truncate">{ownerName || 'Друг'}</p>
                      {sharedGroup && (
                        <p className="text-xs font-semibold text-gray-600 truncate mt-0.5">Группа «{sharedGroup.name}»</p>
                      )}
                      {daysToBirthday !== null && (
                        <p className="text-xs font-semibold text-accent-text mt-0.5">{birthdayLabel(daysToBirthday)}</p>
                      )}
                    </div>
                    <button
                      onClick={exitGuestMode}
                      className="whitespace-nowrap px-3.5 py-2 min-h-11 rounded-2xl text-xs font-bold bg-white text-accent-text border border-rose-100 hover:bg-rose-100 transition-all"
                    >
                      Мой вишлист
                    </button>
                  </div>
                  {wishesLoaded && wishes.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1.5">
                        <span>Забронировано</span>
                        <span>{reservedCount} из {wishes.length}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-500"
                          style={{ width: `${(reservedCount / wishes.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Categories Horizontal Scroll */}
            {!ownerNotFound && (
            <div className="flex items-start gap-2 mb-2">
            <div ref={groupChipsRef} className="flex flex-1 min-w-0 overflow-x-auto gap-2 pb-2 pr-8 custom-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]">
              <button
                onClick={() => setActiveFilter('all')}
                aria-pressed={activeFilter === 'all'}
                data-active-chip={activeFilter === 'all'}
                className={`sticky left-0 z-10 whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${activeFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
              >
                Все
              </button>
              <button
                onClick={() => setActiveFilter('unassigned')}
                aria-pressed={activeFilter === 'unassigned'}
                data-active-chip={activeFilter === 'unassigned'}
                className={`whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${activeFilter === 'unassigned' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
              >
                Без группы
              </button>
              {groups.map(group => {
                const isActive = activeFilter === group.id;
                const canEdit = !isGuest && isActive;
                return (
                  <div
                    key={group.id}
                    data-active-chip={isActive}
                    className={`flex flex-none items-stretch rounded-2xl text-sm font-semibold transition-all ${isActive ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
                  >
                    <button
                      onClick={() => setActiveFilter(group.id)}
                      aria-pressed={isActive}
                      className={`whitespace-nowrap py-2.5 min-h-11 pl-4 ${canEdit ? 'pr-2' : 'pr-4'}`}
                    >
                      {group.name}
                    </button>
                    {canEdit && (
                      // Правка активной группы прямо на её «таблетке»: переименовать или удалить
                      <button
                        onClick={() => { setIsManageGroupsOpen(true); setRenamingGroupId(group.id); setRenameValue(group.name); }}
                        aria-label={`Изменить группу ${group.name}`}
                        className="flex items-center pl-1 pr-3.5 text-white/70 hover:text-white transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!isGuest && <span aria-hidden="true" className="w-px flex-none self-stretch my-1.5 bg-gray-200" />}
              {!isGuest && (
                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold bg-rose-50 text-accent-text hover:bg-rose-100 transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              )}
              {isGuest && (
                <button
                  onClick={() => setOnlyFree(v => !v)}
                  aria-pressed={onlyFree}
                  className={`whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all flex items-center gap-1.5 ${onlyFree ? 'bg-emerald-500 text-on-accent shadow-md' : 'bg-emerald-50 text-success-text hover:bg-emerald-100'}`}
                >
                  <Check className="h-4 w-4" />
                  Свободные
                </button>
              )}
            </div>
            {/* Весь список групп с поиском и счётчиками в одном листе — доступен всегда */}
            <button
              onClick={() => { setGroupPickerQuery(''); setIsGroupPickerOpen(true); }}
              aria-label="Все группы"
              className="flex-none flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <Folder className="h-5 w-5" />
            </button>
            </div>
            )}

            {!isGuest && swipeHintVisible && wishesLoaded && wishes.length > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-tile pl-4 pr-1.5 py-1.5">
                <p className="flex-1 text-xs font-semibold text-gray-600">Смахните желание: влево — удалить, вправо — перенести или дублировать</p>
                <button
                  onClick={dismissSwipeHint}
                  className="min-h-11 px-3 rounded-2xl text-xs font-bold text-accent-text hover:bg-rose-100 active:scale-95 transition-all"
                >
                  Понятно
                </button>
              </div>
            )}

            {(() => {
              if (ownerNotFound) {
                return (
                  <div role="alert" className="flex flex-col items-center justify-center text-center mt-16 text-gray-500 px-6">
                    <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
                      <LinkIcon className="h-12 w-12 text-rose-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Вишлист не найден</h3>
                    <p className="text-base text-gray-500">Ссылка устарела или неверна. Попросите друга прислать её ещё раз.</p>
                    <button
                      onClick={exitGuestMode}
                      className="mt-6 px-6 py-3 min-h-11 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-tile shadow-lg shadow-pink-200/50 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Открыть мой вишлист
                    </button>
                  </div>
                );
              }
              const displayedWishes = wishes.filter(wish => {
                if (isGuest && onlyFree && reservationsByWishId[wish.id]) return false;
                if (activeFilter === 'all') return true;
                if (activeFilter === 'unassigned') return !wish.groupId || wish.groupId === 'unassigned';
                return wish.groupId === activeFilter;
              });

              // Пустой вишлист у гостя может оказаться «владелец не найден» — пока профиль не пришёл, не гадаем
              if (!wishesLoaded || !groupsLoaded || (isGuest && wishes.length === 0 && ownerProfileState === 'loading')) {
                return (
                  <div className="space-y-4" aria-busy="true" aria-label="Загрузка желаний">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="bg-white rounded-card p-3.5 border border-gray-100 flex gap-4 animate-pulse motion-reduce:animate-none">
                        <div className="h-28 w-28 flex-shrink-0 rounded-tile bg-gray-100" />
                        <div className="flex flex-col flex-grow justify-between py-1.5 pr-1">
                          <div className="space-y-2.5">
                            <div className="h-4 w-4/5 rounded-full bg-gray-100" />
                            <div className="h-4 w-1/2 rounded-full bg-gray-100" />
                            <div className="h-6 w-20 rounded-lg bg-rose-50" />
                          </div>
                          <div className="h-8 w-24 self-end rounded-2xl bg-gray-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              if (displayedWishes.length === 0) {
                const emptyText = isGuest
                  ? (onlyFree && wishes.length > 0
                      ? 'Все подарки уже разобрали 🎉'
                      : activeFilter === 'all' ? 'Друг пока ничего не добавил.' : 'В этой группе пока нет желаний.')
                  : (activeFilter === 'all'
                      ? 'Добавьте своё первое желание, чтобы друзья знали, чем вас порадовать!'
                      : 'В этой группе ещё нет желаний.');

                return (
                  <div className="flex flex-col items-center justify-center text-center mt-20 text-gray-500 px-6">
                    <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
                      {activeFilter === 'all' ? (
                        <Heart className="h-12 w-12 text-rose-300 fill-rose-100" />
                      ) : (
                        <Folder className="h-12 w-12 text-rose-300 fill-rose-100" />
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Здесь пока пусто</h3>
                    <p className="text-base text-gray-500">{emptyText}</p>
                    {!isGuest && (
                      <button
                        onClick={openAddModal}
                        className="mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button px-7 py-3.5 shadow-lg shadow-pink-200/50 active:scale-[0.98] transition-all"
                      >
                        <PlusCircle className="h-5 w-5" />
                        Добавить желание
                      </button>
                    )}
                  </div>
                );
              }

              return displayedWishes.map((wish) => {
                const isMine = wish.ownerId === user?.uid;
                const reservedBy = reservationsByWishId[wish.id] ?? null;
                const isReservedByMe = reservedBy === user?.uid;
                const isReservedByOther = !!reservedBy && reservedBy !== user?.uid;

                return (
                  <SwipeRow
                    key={wish.id}
                    enabled={isMine && !isGuest}
                    onSwipeLeft={() => deleteWish(wish)}
                    onSwipeRight={() => openWishActions(wish.id)}
                    onArm={() => { if (tgSupports('6.1')) window.Telegram.WebApp.HapticFeedback?.impactOccurred('light'); }}
                  >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Открыть желание: ${wish.title}`}
                    onClick={() => setSelectedWishId(wish.id)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setSelectedWishId(wish.id);
                      }
                    }}
                    className="bg-white rounded-card p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 flex gap-4 transition-all hover:shadow-md relative group cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-300"
                  >
                    {/* Image Thumbnail */}
                    <div className="h-28 w-28 flex-shrink-0 rounded-tile overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-50 relative">
                      {wish.imageUrl ? (
                        <img
                          src={wish.imageUrl}
                          alt={wish.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlNWE1YTUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjIiIHJ5PSIyIi8+PGNpcmNsZSBjeD0iOS41IiBjeT0iOS41IiByPSIxLjUiLz48cGF0aCBkPSJtMjEgMTUtMy4wOC0zLjA4YTEuMzMgMS4zMyAwIDAgMC0xLjg4IDBMOSAxNGwyLjI2IDIuMjZhMS4zMyAxLjMzIDAgMCAwIDEuODggMEwyMSAxM3YyIi8+PC9zdmc+';
                          }}
                        />
                      ) : (
                        <Gift className="h-10 w-10 text-gray-300" />
                      )}
                      {isMine && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteWish(wish); }}
                          aria-label="Удалить желание"
                          className="absolute top-2 right-2 p-2 bg-white/95 backdrop-blur-sm rounded-full text-danger-text shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-red-50 before:content-[''] before:absolute before:-inset-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Wish Details */}
                    <div className="flex flex-col flex-grow min-w-0 justify-between py-1.5 pr-1">
                      <div>
                        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-[16px] break-words">
                          {wish.title}
                        </h3>
                        {wish.price && (
                          <div className="inline-block max-w-full mt-2 bg-rose-50 px-2.5 py-1 rounded-lg">
                             <p className="text-accent-text font-bold text-sm break-words line-clamp-1">{wish.price}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {isSafeLink(wish.link) ? (
                          <a
                            href={wish.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => { e.stopPropagation(); openExternal(e, wish.link); }}
                            className="relative text-xs font-semibold text-gray-500 hover:text-accent-text flex items-center gap-1 transition-colors before:content-[''] before:absolute before:-inset-x-2 before:-inset-y-3.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            В магазин
                          </a>
                        ) : (
                          <div /> // Spacer
                        )}

                        {!isMine ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleReserve(wish, isReservedByMe); }}
                            disabled={isReservedByOther}
                            className={`px-5 py-2.5 min-h-11 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm ${
                              isReservedByMe
                                ? 'bg-emerald-50 text-success-text border border-emerald-100 hover:bg-emerald-100'
                                : isReservedByOther
                                  ? 'bg-gray-100 text-gray-600 cursor-not-allowed shadow-none'
                                  : 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-pink-200/50 hover:shadow-md hover:scale-[1.02] active:scale-95'
                            }`}
                          >
                            {isReservedByMe && <CheckCircle className="h-3.5 w-3.5" />}
                            {isReservedByMe ? 'Я дарю!' : isReservedByOther ? 'Занято' : 'Подарить'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  </SwipeRow>
                );
              });
            })()}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <IdeaSwipeStack
            db={db}
            appId={appId}
            user={user}
            interests={userProfile?.interests || []}
            groups={groups}
            ownerName={tgUser?.first_name}
          />
        )}

        {activeTab === 'reserved' && (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-2xl font-bold text-gray-900">Я дарю</h2>
              <p className="text-sm text-gray-500 font-medium mt-1">Подарки, которые вы забронировали у друзей.</p>
            </div>

            {reservedWishes.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center mt-16 text-gray-500 px-6">
                <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
                  <Heart className="h-12 w-12 text-rose-300 fill-rose-100" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Пока ничего нет</h3>
                <p className="text-base text-gray-500">Откройте вишлист друга по ссылке и нажмите «Подарить» — подарок появится здесь.</p>
              </div>
            ) : (
              reservedWishes.map((wish) => (
                <div
                  key={wish.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Открыть желание: ${wish.title}`}
                  onClick={() => setSelectedWishId(wish.id)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setSelectedWishId(wish.id);
                    }
                  }}
                  className="bg-white rounded-card p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 flex gap-4 transition-all hover:shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-300"
                >
                  <div className="h-24 w-24 flex-shrink-0 rounded-tile overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-50">
                    {wish.imageUrl ? (
                      <img src={wish.imageUrl} alt={wish.title} className="h-full w-full object-cover" />
                    ) : (
                      <Gift className="h-9 w-9 text-gray-300" />
                    )}
                  </div>
                  <div className="flex flex-col flex-grow min-w-0 justify-between py-1">
                    <div>
                      <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-[16px] break-words">{wish.title}</h3>
                      <p className="text-xs font-semibold text-gray-500 mt-1 truncate">
                        Для: {wish.ownerName || 'друга'}{wish.price ? ` · ${wish.price}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openFriendWishlist(wish.ownerId); }}
                        className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                      >
                        Вишлист
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleReserve(wish, true); }}
                        className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        Снять бронь
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="flex flex-col items-center mt-8 px-4">
            <div className="relative mb-5">
              <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-100 to-pink-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden relative z-10">
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Фото профиля" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-rose-300" />
                )}
              </div>
              <div className="absolute top-0 -inset-1 bg-gradient-to-r from-rose-400 to-pink-400 rounded-full blur opacity-30"></div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900">
              {tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}` : 'Мой Профиль'}
            </h2>
            {tgUser?.username && (
              <p className="text-sm text-gray-500 mt-1 font-medium bg-gray-100 px-3 py-1 rounded-lg">
                @{tgUser.username}
              </p>
            )}

            {/* Profile Info Display */}
            {userProfile && (
              <div className="flex gap-4 mt-4">
                {userProfile.birthdate && (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                    <Calendar className="h-4 w-4 text-rose-400" />
                    {formatBirthdate(userProfile.birthdate)}
                  </div>
                )}
                {userProfile.gender && userProfile.gender !== 'Не указано' && (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    <User className="h-4 w-4 text-indigo-400" />
                    {userProfile.gender}
                  </div>
                )}
              </div>
            )}
            
            {/* Исправленный блок статистики */}
            <div className="mt-8 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
              <h3 className="font-semibold text-gray-900 mb-4 text-lg">Статистика</h3>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-tile mb-3">
                <span className="text-gray-500 font-medium">Мои желания</span>
                <span className="font-bold text-xl text-rose-500">
                  {wishes.filter(w => w.ownerId === user?.uid).length}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('reserved')}
                className="w-full flex justify-between items-center bg-gray-50 p-4 rounded-tile hover:bg-gray-100 active:scale-[0.99] transition-all"
              >
                <span className="text-gray-500 font-medium flex items-center gap-1.5">
                  Я дарю
                  <ArrowRight className="h-4 w-4" />
                </span>
                <span className="font-bold text-xl text-success-text">
                  {reservedWishes.length}
                </span>
              </button>
            </div>

            <div className="mt-4 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-lg">Интересы</h3>
                <button
                  onClick={openInterests}
                  className="flex items-center gap-1.5 px-3.5 py-2 min-h-11 rounded-2xl text-xs font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {userProfile?.interests?.length ? 'Изменить' : 'Выбрать'}
                </button>
              </div>
              {userProfile?.interests?.length ? (
                <div className="flex flex-wrap gap-2">
                  {userProfile.interests.map(name => (
                    <span key={name} className="bg-rose-50 text-accent-text text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 font-medium">Добавьте интересы — так друзьям будет проще выбрать подарок.</p>
              )}
            </div>

            <div className="mt-4 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
              <h3 className="font-semibold text-gray-900 mb-3 text-lg">Тема</h3>
              <div className="grid grid-cols-3 gap-1 bg-gray-50 p-1 rounded-tile" role="group" aria-label="Тема оформления">
                {([['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']] as [ThemePreference, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => handleThemeChange(value)}
                    aria-pressed={themePref === value}
                    className={`py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${themePref === value ? 'bg-white text-accent-text shadow-sm' : 'text-gray-500 hover:text-gray-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 font-medium mt-3">«Авто» повторяет тему Telegram.</p>
            </div>
          </div>
        )}
      </main>

      {/* Add Modal Overlay */}
      <div 
        className={`absolute inset-0 z-40 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${isAddModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
        onClick={requestCloseAddModal} 
      />
      
      {/* Add Modal Bottom Sheet */}
      <div
        role="dialog"
        data-overlay="add"
        tabIndex={-1}
        aria-modal="true"
        aria-label={editingWishId ? 'Изменить желание' : 'Новое желание'}
        aria-hidden={!isAddModalOpen}
        {...inertWhen(!isAddModalOpen)}
        className={`outline-none absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out max-h-[90dvh] overflow-y-auto custom-scrollbar ${isAddModalOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />

          <button
            onClick={requestCloseAddModal}
            aria-label="Закрыть"
            className="absolute top-5 right-5 h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingWishId ? 'Изменить желание' : 'Новое желание ✨'}</h2>
          
          <form onSubmit={handleAddWish} className="space-y-4">

            <div className="relative">
              <Gift className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
              <input
                type="text"
                placeholder="Что вы хотите?"
                aria-label="Название желания"
                required
                maxLength={200}
                value={newWish.title}
                onChange={(e) => { autoFilledRef.current.title = false; setNewWish({...newWish, title: e.target.value}); }}
                className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
              />
            </div>

            {/* Group Selector */}
            <div className="flex flex-col gap-2 mb-2">
              <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-xs px-1">Группа желаний</label>
              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                <button
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: 'unassigned'})}
                    aria-pressed={newWish.groupId === 'unassigned'}
                    className={`whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${newWish.groupId === 'unassigned' ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                >
                    Без группы
                </button>
                {groups.map(group => (
                    <button
                    key={group.id}
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: group.id})}
                    aria-pressed={newWish.groupId === group.id}
                    className={`whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${newWish.groupId === group.id ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                    {group.name}
                    </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold bg-rose-50 text-accent-text hover:bg-rose-100 transition-all flex items-center gap-1.5 border-2 border-transparent"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-[2]">
                <Tag className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Цена (необязательно)"
                  aria-label="Цена"
                  value={newWish.priceAmount}
                  onChange={(e) => { autoFilledRef.current.priceAmount = false; setNewWish({...newWish, priceAmount: e.target.value}); }}
                  className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
                />
              </div>
              <select
                value={newWish.priceCurrency}
                onChange={(e) => setNewWish({...newWish, priceCurrency: e.target.value})}
                aria-label="Валюта"
                className="flex-1 bg-gray-50 border-2 border-transparent text-gray-900 rounded-button px-2 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold text-center"
              >
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
              <input
                ref={linkInputRef}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Ссылка на товар (необязательно)"
                aria-label="Ссылка на товар"
                aria-invalid={linkTouched && !!linkProblem(newWish.link)}
                aria-describedby={linkTouched && linkProblem(newWish.link) ? 'wish-link-error' : undefined}
                value={newWish.link}
                onChange={(e) => setNewWish({...newWish, link: e.target.value})}
                onBlur={() => { if (newWish.link.trim()) setLinkTouched(true); }}
                className={`w-full bg-gray-50 border-2 text-gray-900 rounded-button py-4 pl-14 pr-32 outline-none focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500 ${linkTouched && linkProblem(newWish.link) ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-rose-200'}`}
              />
              {isSafeLink(normalizeLink(newWish.link)) && !linkProblem(newWish.link) && (
                <button
                  type="button"
                  onClick={handleParseLink}
                  disabled={isParsingLink}
                  className="absolute right-2 top-2 bottom-2 px-3.5 rounded-2xl text-xs font-bold bg-rose-50 text-accent-text hover:bg-rose-100 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isParsingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Заполнить
                </button>
              )}
              {linkTouched && linkProblem(newWish.link) && (
                <p id="wish-link-error" role="alert" className="mt-1.5 px-2 text-sm font-medium text-danger-text">
                  {linkProblem(newWish.link)}
                </p>
              )}
            </div>

            <textarea
              placeholder="Комментарий: размер, цвет, пожелания (необязательно)"
              aria-label="Комментарий к желанию"
              rows={2}
              maxLength={500}
              value={newWish.note}
              onChange={(e) => { autoFilledRef.current.note = false; setNewWish({...newWish, note: e.target.value}); }}
              className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 px-5 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500 resize-none"
            />

            <div className="relative">
              {newWish.imageUrl ? (
                <div className="relative w-full h-32 rounded-button overflow-hidden border-2 border-gray-100 bg-gray-50">
                  <img src={newWish.imageUrl} alt="Выбранное фото" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => { autoFilledRef.current.imageUrl = false; setNewWish({...newWish, imageUrl: ''}); }}
                    aria-label="Убрать фото"
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 text-gray-500 hover:text-danger-text transition-colors shadow-sm"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-button bg-gray-50 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer group">
                  {isImageProcessing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500 mb-2" />
                  ) : (
                    <Camera className="h-6 w-6 text-gray-500 mb-2 group-hover:text-rose-400 transition-colors" />
                  )}
                  <span className="text-sm font-semibold text-gray-500 group-hover:text-rose-400 transition-colors">
                    {isImageProcessing ? 'Обработка...' : 'Загрузить фото (необязательно)'}
                  </span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                    disabled={isImageProcessing}
                  />
                </label>
              )}
            </div>

            {!nativeMain && <button 
              type="submit" 
              disabled={isSubmitting || isImageProcessing || !newWish.title.trim()}
              className="w-full mt-4 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-6 w-6" />
                  {editingWishId ? 'Сохранить изменения' : 'Сохранить в вишлист'}
                </>
              )}
            </button>}
          </form>
        </div>
      </div>

      {/* Floating Bottom Navigation: «+» по центру панели, вкладки с подписями по бокам */}
      <div className="absolute bottom-6 left-0 right-0 z-30 px-6 flex justify-center pointer-events-none">
        <nav className="bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-gray-100 rounded-full w-full max-w-[360px] px-2 py-2 grid grid-cols-5 items-center justify-items-center pointer-events-auto">
          {NAV_TABS.slice(0, 2).map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { if (id === 'home') exitGuestMode(); setActiveTab(id); }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition-colors ${isActive ? 'text-accent-text' : 'text-gray-500 hover:text-gray-600'}`}
              >
                <Icon strokeWidth={isActive ? 2.5 : 2} className="h-6 w-6" />
                <span className={`text-xs leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
                {id === 'reserved' && reservedWishes.length > 0 && (
                  <span className="absolute top-0 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-accent text-xs font-bold leading-none flex items-center justify-center">
                    {reservedWishes.length}
                  </span>
                )}
              </button>
            );
          })}

          {/* Центральная колонка сетки — кнопка «+» ровно по центру панели */}
          <button
            onClick={() => { exitGuestMode(); openAddModal(); }}
            aria-label="Добавить желание"
            className="bg-gradient-to-tr from-accent to-accent-2 h-14 w-14 rounded-full text-on-accent shadow-lg shadow-pink-200/60 hover:scale-105 active:scale-95 transition-all -mt-8 border-[4px] border-app flex items-center justify-center"
          >
            <PlusCircle className="h-7 w-7" strokeWidth={2.5} />
          </button>

          {NAV_TABS.slice(2).map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { if (id === 'profile') exitGuestMode(); setActiveTab(id); }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition-colors ${isActive ? 'text-accent-text' : 'text-gray-500 hover:text-gray-600'}`}
              >
                <Icon strokeWidth={isActive ? 2.5 : 2} className="h-6 w-6" />
                <span className={`text-xs leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Create Group Modal */}
      {isGroupModalOpen && (
        <div className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
            <div role="dialog"
        data-overlay="group-create"
        tabIndex={-1} aria-modal="true" aria-label="Новая группа" className="outline-none bg-white rounded-sheet p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Folder className="h-6 w-6 text-rose-500" />
                  Новая группа
                </h3>
                <form onSubmit={handleAddGroup}>
                    <input 
                        type="text"
                        placeholder="Например: Мой вишлист"
                        aria-label="Название группы"
                        aria-invalid={!!groupNameError(newGroupName)}
                        maxLength={GROUP_NAME_MAX}
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className={`w-full bg-gray-50 border-2 text-gray-900 rounded-tile py-4 px-5 outline-none focus:bg-white transition-all font-semibold placeholder:text-gray-500 ${groupNameError(newGroupName) ? 'border-red-300 focus:border-red-400 mb-1.5' : 'border-transparent focus:border-rose-200 mb-3'}`}
                        autoFocus
                    />
                    {groupNameError(newGroupName) && (
                      <p role="alert" className="mb-3 px-2 text-sm font-medium text-danger-text">{groupNameError(newGroupName)}</p>
                    )}
                    
                    {/* Быстрые подсказки */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {(() => {
                        const suggestions = ['День рождения 🥳', 'Новый год 🎄'];
                        
                        if (userProfile?.gender === 'Мужской') {
                          suggestions.push('23 Февраля 🛡️');
                        } else if (userProfile?.gender === 'Женский') {
                          suggestions.push('8 Марта 🌷');
                        } else {
                          // Фолбэк, если пол по какой-то причине не был указан
                          suggestions.push('8 Марта 🌷', '23 Февраля 🛡️');
                        }
                        
                        suggestions.push('Свадьба 💍');

                        // Уже созданные группы не предлагаем повторно
                        return suggestions.filter(suggestion => !groupNameError(suggestion)).map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setNewGroupName(suggestion)}
                            className="bg-rose-50 text-accent-text text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all"
                          >
                            {suggestion}
                          </button>
                        ));
                      })()}
                    </div>

                    <div className="flex gap-3">
                        <button 
                            type="button"
                            onClick={() => setIsGroupModalOpen(false)}
                            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-tile hover:bg-gray-200 transition-colors"
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit"
                            disabled={!newGroupName.trim() || !!groupNameError(newGroupName)}
                            className="flex-1 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-semibold py-3.5 rounded-tile shadow-lg shadow-pink-200/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
                        >
                            Создать
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Interests Sheet */}
      {isInterestsOpen && (() => {
        const q = normalizeSearch(interestsQuery);
        const categories = INTEREST_CATEGORIES
          .map(category => ({
            ...category,
            // Запрос совпал с названием категории — показываем её целиком
            items: !q || normalizeSearch(category.name).includes(q)
              ? category.items
              : category.items.filter(item => normalizeSearch(item).includes(q)),
          }))
          .filter(category => category.items.length > 0);

        return (
          <>
            <div
              className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsInterestsOpen(false)}
            />
            <div role="dialog"
        data-overlay="interests"
        tabIndex={-1} aria-modal="true" aria-label="Интересы" className="outline-none absolute bottom-0 left-0 right-0 z-[70] h-[90dvh] flex flex-col bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300">
              <div className="px-6 pt-5 pb-3 flex-none">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Интересы</h2>
                  <button
                    onClick={() => setIsInterestsOpen(false)}
                    aria-label="Закрыть"
                    className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                  <input
                    type="text"
                    inputMode="search"
                    placeholder="Найти интерес"
                    aria-label="Поиск по интересам"
                    value={interestsQuery}
                    onChange={(e) => setInterestsQuery(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-tile py-3 pl-12 pr-11 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
                  />
                  {interestsQuery && (
                    <button
                      onClick={() => setInterestsQuery('')}
                      aria-label="Очистить поиск"
                      className="absolute right-3 top-2.5 p-1.5 text-gray-500 hover:text-gray-600"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5 custom-scrollbar">
                {categories.length === 0 ? (
                  <p className="text-center text-gray-500 font-medium py-10">Ничего не нашлось. Попробуйте другое слово.</p>
                ) : (
                  categories.map(category => (
                    <section key={category.name}>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
                        {category.emoji} {category.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {category.items.map(item => {
                          const selected = interestsDraft.includes(item);
                          return (
                            <button
                              key={item}
                              onClick={() => toggleInterest(item)}
                              aria-pressed={selected}
                              className={`px-3.5 py-2 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${selected ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'}`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="flex-none px-6 pt-3 pb-safe border-t border-gray-100">
                <button
                  onClick={saveInterests}
                  disabled={isSavingInterests}
                  className="w-full mb-3 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isSavingInterests ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-6 w-6" />
                      {interestsDraft.length ? `Сохранить (${interestsDraft.length})` : 'Сохранить'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Group Picker Modal */}
      {isGroupPickerOpen && (() => {
        const q = normalizeSearch(groupPickerQuery);
        const countFor = (id: string) => wishes.filter(w => (id === 'unassigned' ? (!w.groupId || w.groupId === 'unassigned') : w.groupId === id)).length;
        const rows = [
          { id: 'all', name: 'Все желания', count: wishes.length },
          { id: 'unassigned', name: 'Без группы', count: countFor('unassigned') },
          ...groups.map(g => ({ id: g.id, name: g.name, count: countFor(g.id) })),
        ].filter(r => !q || normalizeSearch(r.name).includes(q));
        return (
          <div
            className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsGroupPickerOpen(false)}
          >
            <div
              role="dialog"
        data-overlay="group-picker"
        tabIndex={-1}
              aria-modal="true"
              aria-label="Группы"
              className="outline-none bg-white rounded-sheet p-6 w-full max-w-sm max-h-[80dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Folder className="h-6 w-6 text-rose-500" />
                  Группы
                </h3>
                <button
                  onClick={() => setIsGroupPickerOpen(false)}
                  aria-label="Закрыть"
                  className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  inputMode="search"
                  placeholder="Найти группу"
                  aria-label="Поиск по группам"
                  value={groupPickerQuery}
                  onChange={(e) => setGroupPickerQuery(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-tile py-3 pl-12 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
                />
              </div>
              {rows.length === 0 ? (
                <p className="text-gray-500 font-medium py-4 text-center">Ничего не найдено.</p>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map(row => (
                    <li key={row.id}>
                      <button
                        onClick={() => { setActiveFilter(row.id); setIsGroupPickerOpen(false); }}
                        aria-current={activeFilter === row.id}
                        className={`w-full flex items-center gap-3 rounded-tile px-4 py-3 text-left font-semibold transition-all active:scale-[0.99] ${activeFilter === row.id ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'}`}
                      >
                        <span className="flex-1 min-w-0 truncate">{row.name}</span>
                        <span className={`text-sm ${activeFilter === row.id ? 'text-white/70' : 'text-gray-500'}`}>{row.count}</span>
                        {activeFilter === row.id && <Check className="h-4 w-4" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!isGuest && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { setIsGroupPickerOpen(false); setIsGroupModalOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-tile text-sm font-bold bg-rose-50 text-accent-text hover:bg-rose-100 active:scale-95 transition-all"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Создать
                  </button>
                  <button
                    onClick={() => { setIsGroupPickerOpen(false); setIsManageGroupsOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-tile text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    <Pencil className="h-4 w-4" />
                    Изменить
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Manage Groups Modal */}
      {isManageGroupsOpen && (
        <div
          className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setIsManageGroupsOpen(false); setRenamingGroupId(null); }}
        >
          <div
            role="dialog"
        data-overlay="group-manage"
        tabIndex={-1}
            aria-modal="true"
            aria-label="Мои группы"
            className="outline-none bg-white rounded-sheet p-6 w-full max-w-sm max-h-[80dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Folder className="h-6 w-6 text-rose-500" />
                Мои группы
              </h3>
              <button
                onClick={() => { setIsManageGroupsOpen(false); setRenamingGroupId(null); }}
                aria-label="Закрыть"
                className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="text-gray-500 font-medium py-4 text-center">Групп пока нет.</p>
            ) : (
              <ul className="space-y-2">
                {groups.map(group => (
                  <li key={group.id} className="flex items-center gap-2 bg-gray-50 rounded-tile p-2 pl-4">
                    {renamingGroupId === group.id ? (
                      <form
                        className="flex flex-1 min-w-0 items-center gap-2"
                        onSubmit={(e) => { e.preventDefault(); handleRenameGroup(group); }}
                      >
                        <input
                          autoFocus
                          maxLength={100}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 min-w-0 bg-white border-2 border-rose-200 text-gray-900 rounded-2xl py-2 px-3 outline-none font-semibold"
                        />
                        <button
                          type="submit"
                          disabled={!renameValue.trim()}
                          aria-label="Сохранить название"
                          className="p-2.5 rounded-full bg-emerald-50 text-success-text hover:bg-emerald-100 disabled:opacity-50 transition-all"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingGroupId(null)}
                          aria-label="Отменить переименование"
                          className="p-2.5 rounded-full bg-white text-gray-500 hover:bg-gray-100 transition-all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 truncate font-semibold text-gray-900">{group.name}</span>
                        <button
                          onClick={() => { setRenamingGroupId(group.id); setRenameValue(group.name); }}
                          aria-label={`Переименовать группу ${group.name}`}
                          className="p-2.5 rounded-full bg-white text-gray-500 hover:text-rose-500 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(e, group)}
                          aria-label={`Удалить группу ${group.name}`}
                          className="p-2.5 rounded-full bg-white text-danger-text hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Wish Actions Sheet: перенести в другую группу / сделать копию */}
      {actionWishId && (() => {
        const wish = wishes.find(w => w.id === actionWishId);
        if (!wish) return null;
        const currentGroup = wish.groupId || 'unassigned';
        const rows = [{ id: 'unassigned', name: 'Без группы' }, ...groups.map(g => ({ id: g.id, name: g.name }))];
        return (
          <>
            <div className="absolute inset-0 z-[90] bg-black/45 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActionWishId(null)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Действия с желанием: ${wish.title}`}
              data-overlay="wish-actions"
              tabIndex={-1}
              className="outline-none absolute bottom-0 left-0 right-0 z-[95] max-h-[85dvh] overflow-y-auto bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300 custom-scrollbar"
            >
              <div className="p-7 pb-10">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-gray-900">{actionMode === 'move' ? 'Перенести в группу' : 'Дублировать в группу'}</h3>
                    <p className="text-sm font-medium text-gray-600 truncate mt-0.5">{wish.title}</p>
                  </div>
                  <button
                    onClick={() => setActionWishId(null)}
                    aria-label="Закрыть"
                    className="flex-none h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex gap-2 mb-4">
                  {([['move', 'Перенести', FolderInput], ['copy', 'Дублировать', Copy]] as const).map(([mode, label, Icon]) => (
                    <button
                      key={mode}
                      onClick={() => setActionMode(mode)}
                      aria-pressed={actionMode === mode}
                      className={`flex-1 flex items-center justify-center gap-2 min-h-11 rounded-tile text-sm font-bold transition-all active:scale-95 ${
                        actionMode === mode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <ul className="space-y-1.5">
                  {rows.map(row => {
                    const isCurrent = row.id === currentGroup;
                    const disabled = actionMode === 'move' && isCurrent;
                    return (
                      <li key={row.id}>
                        <button
                          onClick={() => actionMode === 'move' ? moveWish(wish, row.id) : duplicateWish(wish, row.id)}
                          disabled={disabled}
                          className="w-full flex items-center gap-3 min-h-11 rounded-tile px-4 py-3 text-left font-semibold bg-gray-50 text-gray-900 hover:bg-gray-100 disabled:opacity-60 disabled:hover:bg-gray-50 active:scale-[0.99] transition-all"
                        >
                          <span className="flex-1 min-w-0 truncate">{row.name}</span>
                          {isCurrent && <span className="text-xs font-semibold text-gray-600">сейчас здесь</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        );
      })()}

      {/* Wish Detail Modal */}
      {selectedWishId && (() => {
        const wish = wishes.find((w) => w.id === selectedWishId) || reservedWishes.find((w) => w.id === selectedWishId);
        if (!wish) return null;
        const isMine = wish.ownerId === user?.uid;
        // Открыт либо из списка друга (тогда бронь есть в reservationsByWishId), либо из «Я дарю»
        // (тогда сам факт присутствия в reservedWishes уже значит «забронировано мной»)
        const isReservedByMe = reservationsByWishId[wish.id] === user?.uid || reservedWishes.some(w => w.id === wish.id);
        const isReservedByOther = !isReservedByMe && !!reservationsByWishId[wish.id] && reservationsByWishId[wish.id] !== user?.uid;

        return (
          <div
            className="absolute inset-0 z-[80] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedWishId(null)}
          >
            <div
              role="dialog"
        data-overlay="detail"
        tabIndex={-1}
              aria-modal="true"
              aria-label={wish.title}
              className="outline-none bg-white rounded-sheet w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <div className="h-56 w-full bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-[32px]">
                  {wish.imageUrl ? (
                    <img
                      src={wish.imageUrl}
                      alt={wish.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Gift className="h-16 w-16 text-gray-300" />
                  )}
                </div>
                <button
                  onClick={() => setSelectedWishId(null)}
                  aria-label="Закрыть"
                  className="absolute top-2 right-2 h-11 w-11 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-full text-gray-500 shadow-sm hover:bg-gray-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 break-words leading-snug">
                  {wish.title}
                </h3>

                {wish.price && (
                  <div className="inline-block max-w-full mt-3 bg-rose-50 px-3 py-1.5 rounded-lg">
                    <p className="text-accent-text font-bold text-base break-words">{wish.price}</p>
                  </div>
                )}

                {isSafeLink(wish.link) && (
                  <a
                    href={wish.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => openExternal(e, wish.link)}
                    className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-rose-500 transition-colors break-all"
                  >
                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    {wish.link}
                  </a>
                )}

                {wish.note && (
                  <p className="mt-4 text-sm font-medium text-gray-600 whitespace-pre-line break-words bg-gray-50 rounded-2xl px-4 py-3">
                    {wish.note}
                  </p>
                )}

                <div className="mt-6">
                  {!isMine ? (
                    <button
                      onClick={() => toggleReserve(wish, isReservedByMe)}
                      disabled={!!isReservedByOther}
                      className={`w-full py-3.5 rounded-tile text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                        isReservedByMe
                          ? 'bg-emerald-50 text-success-text border border-emerald-100 hover:bg-emerald-100'
                          : isReservedByOther
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-pink-200/50 hover:scale-[1.01] active:scale-95'
                      }`}
                    >
                      {isReservedByMe && <CheckCircle className="h-4 w-4" />}
                      {isReservedByMe ? 'Я дарю это · Снять бронь' : isReservedByOther ? 'Уже занято' : 'Подарить'}
                    </button>
                  ) : (
                    <div className="space-y-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditModal(wish)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                      >
                        <Pencil className="h-4 w-4" />
                        Изменить
                      </button>
                      <button
                        onClick={() => deleteWish(wish)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-gray-100 text-danger-text hover:bg-red-50 active:scale-95 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </button>
                    </div>
                    {/* То же, что смахивание карточки вправо, — для тех, кому жест неудобен */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => openWishActions(wish.id, 'move')}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        <FolderInput className="h-4 w-4" />
                        Перенести
                      </button>
                      <button
                        onClick={() => openWishActions(wish.id, 'copy')}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        <Copy className="h-4 w-4" />
                        Дублировать
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Onboarding / Welcome Screen Overlay */}
      {showOnboarding && !isGuest && (
        <div className="absolute inset-0 z-[100] bg-white flex flex-col overflow-y-auto animate-in fade-in duration-300 pb-safe custom-scrollbar">
          <div className="flex-1 px-6 pt-12 flex flex-col items-center">
            {onboardingStep === 1 ? (
              <div className="flex flex-col items-center text-center max-w-sm w-full animate-in slide-in-from-right-8 duration-300 h-full">
                <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-100 to-pink-100 flex items-center justify-center shadow-inner mb-8 border-4 border-white">
                  <Gift className="h-14 w-14 text-rose-500" />
                </div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Шаг 1 из 2</p>
                <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Добро пожаловать в WISHLLY! ✨</h2>
                <p className="text-gray-500 font-medium mb-10 text-lg">Ваш идеальный список желаний, которым хочется делиться.</p>
                
                <div className="space-y-6 text-left w-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-50 p-3.5 rounded-2xl">
                      <Gift className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">Добавляйте желания</h4>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">Сохраняйте все, что хотите получить в подарок.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-50 p-3.5 rounded-2xl">
                      <Folder className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">Сортируйте по поводам</h4>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">Разделяйте подарки на День рождения, Новый год и т.д.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-50 p-3.5 rounded-2xl">
                      <CheckCircle className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">Тайная бронь</h4>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">Друзья могут занять подарок, а для вас это останется сюрпризом!</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-10 w-full pb-8">
                    <button 
                    onClick={() => setOnboardingStep(2)}
                    className="w-full bg-gray-900 text-white font-bold rounded-button py-4 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                    Продолжить <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full max-w-sm animate-in slide-in-from-right-8 duration-300 h-full">
                <div className="w-full flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setOnboardingStep(1)}
                    className="flex items-center gap-1 -ml-2 px-2 py-2.5 rounded-full text-sm font-semibold text-gray-500 hover:text-gray-700 active:scale-95 transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Назад
                  </button>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Шаг 2 из 2</p>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center pt-6">Ещё пара деталей</h2>
                <p className="text-gray-500 font-medium mb-10 text-center">Это поможет друзьям не забыть о вашем празднике.</p>
                
                <div className="w-full space-y-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="onboarding-birthdate" className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Дата рождения *</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
                      <input 
                        id="onboarding-birthdate"
                        type="date" 
                        min={`${MIN_BIRTH_YEAR}-01-01`}
                        max={todayISO()}
                        value={onboardingForm.birthdate}
                        aria-invalid={!!birthdateProblem(onboardingForm.birthdate)}
                        onChange={(e) => setOnboardingForm({...onboardingForm, birthdate: e.target.value})}
                        className={`w-full bg-gray-50 border-2 text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:bg-white transition-all font-semibold ${birthdateProblem(onboardingForm.birthdate) ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-rose-200'}`}
                      />
                    </div>
                    {birthdateProblem(onboardingForm.birthdate) && (
                      <p role="alert" className="px-2 text-sm font-medium text-danger-text">{birthdateProblem(onboardingForm.birthdate)}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Пол *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Мужской', 'Женский'].map(gender => (
                        <button
                          key={gender}
                          onClick={() => setOnboardingForm({...onboardingForm, gender})}
                          className={`py-4 rounded-button font-bold border-2 transition-all ${onboardingForm.gender === gender ? 'border-rose-200 bg-rose-50 text-accent-text' : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          {gender}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-10 w-full pb-8">
                    {(() => {
                      // Почему «Готово» неактивна — говорим прямо, а не оставляем серую кнопку без объяснения
                      const noDate = !onboardingForm.birthdate;
                      const noGender = onboardingForm.gender === 'Не указано';
                      const hint = noDate && noGender ? 'Укажите дату рождения и пол'
                        : noDate ? (birthdateProblem(onboardingForm.birthdate) ? null : 'Укажите дату рождения')
                        : noGender ? 'Выберите пол' : null;
                      return hint ? <p className="mb-3 text-center text-sm font-medium text-gray-500">{hint}</p> : null;
                    })()}
                    <button 
                    onClick={handleCompleteOnboarding}
                    disabled={!onboardingForm.birthdate || !!birthdateProblem(onboardingForm.birthdate) || onboardingForm.gender === 'Не указано' || isSavingProfile}
                    className="w-full bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:shadow-none active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                    {isSavingProfile ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
                    {isSavingProfile ? 'Сохраняем…' : 'Готово'}
                    </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Selection Modal */}
      <div 
        className={`absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${isShareModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
        onClick={() => setIsShareModalOpen(false)} 
      />
      <div
        role="dialog"
        data-overlay="share"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Поделиться вишлистом"
        aria-hidden={!isShareModalOpen}
        {...inertWhen(!isShareModalOpen)}
        className={`outline-none absolute bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out ${isShareModalOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          
          <button 
            onClick={() => setIsShareModalOpen(false)}
            aria-label="Закрыть"
            className="absolute top-5 right-5 h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
             <Share2 className="h-6 w-6 text-rose-500" />
             Поделиться
          </h2>

          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
             <button 
                onClick={() => handleShare('all', 'Все желания')}
                className="w-full flex items-center gap-4 p-4 rounded-tile bg-gray-50 hover:bg-rose-50 transition-colors border-2 border-transparent hover:border-rose-100 group text-left"
             >
                <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:text-rose-500 text-gray-500 transition-colors">
                   <Gift className="h-6 w-6" />
                </div>
                <div>
                   <h4 className="font-bold text-gray-900 text-lg">Все желания</h4>
                   <p className="text-sm font-medium text-gray-500">Отправить общий список</p>
                </div>
             </button>

             {groups.map(group => (
                <button 
                  key={group.id}
                  onClick={() => handleShare(group.id, group.name)}
                  className="w-full flex items-center gap-4 p-4 rounded-tile bg-gray-50 hover:bg-rose-50 transition-colors border-2 border-transparent hover:border-rose-100 group text-left"
               >
                  <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:text-rose-500 text-gray-500 transition-colors">
                     <Folder className="h-6 w-6" />
                  </div>
                  <div>
                     <h4 className="font-bold text-gray-900 text-lg">{group.name}</h4>
                     <p className="text-sm font-medium text-gray-500">Только из этой группы</p>
                  </div>
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <div
        role="status"
        aria-live="polite"
        className={`absolute top-6 left-1/2 -translate-x-1/2 z-[100] w-max max-w-[90%] transition-all duration-300 ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
      >
         <div className="bg-gray-900/90 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-xl font-semibold text-sm flex items-center gap-2">
            {toastIsError
              ? <XCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
              : <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-400" />}
            {toastMessage}
         </div>
      </div>

      {/* Global styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 0px;
          height: 0px;
          background: transparent;
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 16px);
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}