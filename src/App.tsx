import React, { useState, useEffect, useRef } from 'react';
import { 
  Gift, PlusCircle, Home, ExternalLink, CheckCircle, 
  User, X, Link as LinkIcon,
  Tag, Heart, Sparkles, Loader2, Trash2,
  Camera, XCircle, Folder, Calendar, ArrowRight, Check, Share2, Pencil, Search
} from 'lucide-react';
import { INTEREST_CATEGORIES, normalizeSearch } from './interests';
import { getThemePreference, setThemePreference, type ThemePreference } from './theme';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, signInWithCustomToken, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, writeBatch, query, where } from 'firebase/firestore';

interface Wish {
  id: string;
  title: string;
  price?: string;
  link?: string;
  imageUrl?: string;
  note?: string;
  groupId?: string;
  ownerId: string;
  ownerName?: string;
  reservedBy: string | null;
  createdAt: number;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: number;
}

interface Profile {
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
const SHOW_RECOMMENDATIONS = false;

const NAV_TABS = [
  { id: 'home', label: 'Главная', Icon: Home },
  { id: 'reserved', label: 'Я дарю', Icon: Heart },
  ...(SHOW_RECOMMENDATIONS ? [{ id: 'recommendations', label: 'Идеи', Icon: Sparkles }] : []),
  { id: 'profile', label: 'Профиль', Icon: User },
];

const EMPTY_WISH = { title: '', price: '', link: '', imageUrl: '', note: '', groupId: 'unassigned' };

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
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});
const appId = import.meta.env.VITE_APP_ID || 'wishforyou-tma-id';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingForm, setOnboardingForm] = useState({ birthdate: '', gender: 'Не указано' });

  // Form State
  const [newWish, setNewWish] = useState(EMPTY_WISH);
  const [editingWishId, setEditingWishId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  // Groups State
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeFilter, setActiveFilter] = useState(guestView?.groupId || 'all');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
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
    if (tg?.showConfirm) {
      tg.showConfirm(message, (confirmed) => { if (confirmed) onConfirm(); });
    } else if (window.confirm(message)) {
      onConfirm();
    }
  };

  const openAddModal = () => {
    // Пустая группа → новое желание сразу попадает в неё
    const isRealGroup = !isGuest && groups.some(g => g.id === activeFilter);
    setEditingWishId(null);
    setNewWish({ ...EMPTY_WISH, groupId: isRealGroup ? activeFilter : 'unassigned' });
    setIsAddModalOpen(true);
  };

  const openEditModal = (wish: Wish) => {
    setEditingWishId(wish.id);
    setNewWish({
      title: wish.title,
      price: wish.price || '',
      link: wish.link || '',
      imageUrl: wish.imageUrl || '',
      note: wish.note || '',
      groupId: wish.groupId || 'unassigned',
    });
    setSelectedWishId(null);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingWishId(null);
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
    }, (error) => {
      console.error("Error fetching groups:", error);
    });

    return () => {
      unsubscribeWishes();
      unsubscribeGroups();
    };
  }, [user, viewedOwnerId]);

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

    // «Я дарю» — брони текущего пользователя в любых вишлистах
    const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');
    const unsubscribeReserved = onSnapshot(
      query(wishesRef, where('reservedBy', '==', user.uid)),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Wish);
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
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', viewedOwnerId);
    return onSnapshot(
      ref,
      (snap) => setOwnerProfile(snap.exists() ? (snap.data() as Profile) : null),
      (error) => console.error("Error fetching owner profile:", error)
    );
  }, [user, isGuest, viewedOwnerId]);

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
        setNewWish(prev => ({ ...prev, imageUrl: dataUrl }));
        setIsImageProcessing(false);
      };
      img.src = event.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
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
    }
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;
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

    setIsSubmitting(true);
    try {
      const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');
      const fields = {
        title: newWish.title.trim(),
        price: newWish.price,
        link: newWish.link,
        imageUrl: newWish.imageUrl,
        note: newWish.note.trim(),
        groupId: newWish.groupId,
      };
      if (editingWishId) {
        // Правила разрешают владельцу менять всё, кроме ownerId и reservedBy — их здесь нет
        await updateDoc(doc(wishesRef, editingWishId), fields);
        showToast('Изменения сохранены');
      } else {
        await addDoc(wishesRef, {
          ...fields,
          ownerId: user.uid,
          ownerName: tgUser?.first_name || 'Anonymous', // Store TG name if available
          reservedBy: null,
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
      setIsSubmitting(false);
    }
  };

  const toggleReserve = async (wish) => {
    if (!user) return;
    
    const isCurrentlyReservedByMe = wish.reservedBy === user.uid;
    const isReservedByOther = wish.reservedBy && wish.reservedBy !== user.uid;

    if (isReservedByOther) return; // Cannot modify someone else's reservation

    try {
      const wishRef = doc(db, 'artifacts', appId, 'public', 'data', 'wishes', wish.id);
      await updateDoc(wishRef, {
        reservedBy: isCurrentlyReservedByMe ? null : user.uid
      });
      showToast(isCurrentlyReservedByMe ? 'Бронь снята' : 'Вы дарите это желание 🎁');
    } catch (error) {
      console.error("Error updating reservation:", error);
      showToast('Не удалось изменить бронь. Возможно, её уже заняли.', true);
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

    if (window.Telegram?.WebApp?.openTelegramLink) {
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

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsSlowLoad(true), 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // ---- Нативные кнопки Telegram ----

  // BackButton закрывает самый верхний слой: модалки → гостевой режим → вкладку
  let backAction: (() => void) | null = null;
  if (isInterestsOpen) backAction = () => setIsInterestsOpen(false);
  else if (isGroupModalOpen) backAction = () => setIsGroupModalOpen(false);
  else if (isManageGroupsOpen) backAction = () => { setIsManageGroupsOpen(false); setRenamingGroupId(null); };
  else if (selectedWishId) backAction = () => setSelectedWishId(null);
  else if (isShareModalOpen) backAction = () => setIsShareModalOpen(false);
  else if (isAddModalOpen) backAction = closeAddModal;
  else if (isGuest) backAction = exitGuestMode;
  else if (activeTab !== 'home') backAction = () => setActiveTab('home');

  const backActionRef = useRef(backAction);
  backActionRef.current = backAction;
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
            className="flex items-center gap-2 bg-rose-50 text-rose-600 pl-3.5 pr-4 py-2.5 rounded-full border border-rose-100 text-sm font-bold hover:bg-rose-100 active:scale-95 transition-all"
          >
            <Share2 className="h-4 w-4" />
            Поделиться
          </button>
        )}
      </header>

      <main className="flex-grow overflow-y-auto pb-32 pt-5 px-4 custom-scrollbar">
        {activeTab === 'home' && (
          <div className="space-y-4">

            {/* Guest banner: чужой вишлист, открытый по ссылке */}
            {isGuest && (() => {
              const ownerName = ownerProfile?.firstName || wishes[0]?.ownerName;
              const daysToBirthday = daysUntilBirthday(ownerProfile?.birthdate);
              const reservedCount = wishes.filter(w => w.reservedBy).length;

              return (
                <div className="bg-rose-50 border border-rose-100 rounded-tile px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Вишлист друга</p>
                      <p className="font-bold text-gray-900 truncate">{ownerName || 'Друг'}</p>
                      {daysToBirthday !== null && (
                        <p className="text-xs font-semibold text-rose-500 mt-0.5">{birthdayLabel(daysToBirthday)}</p>
                      )}
                    </div>
                    <button
                      onClick={exitGuestMode}
                      className="whitespace-nowrap px-3.5 py-2 rounded-2xl text-xs font-bold bg-white text-rose-500 border border-rose-100 hover:bg-rose-100 transition-all"
                    >
                      Мой вишлист
                    </button>
                  </div>
                  {wishesLoaded && wishes.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
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
            <div className="flex overflow-x-auto gap-2 pb-2 mb-2 pr-8 custom-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]">
              <button
                onClick={() => setActiveFilter('all')}
                className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${activeFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
              >
                Все
              </button>
              <button
                onClick={() => setActiveFilter('unassigned')}
                className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${activeFilter === 'unassigned' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
              >
                Без группы
              </button>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveFilter(group.id)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${activeFilter === group.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
                >
                  {group.name}
                </button>
              ))}
              {!isGuest && <span aria-hidden="true" className="w-px flex-none self-stretch my-1.5 bg-gray-200" />}
              {!isGuest && (
                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              )}
              {!isGuest && groups.length > 0 && (
                <button
                  onClick={() => setIsManageGroupsOpen(true)}
                  aria-label="Управление группами"
                  className="whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 transition-all flex items-center gap-1.5"
                >
                  <Pencil className="h-4 w-4" />
                  Изменить
                </button>
              )}
              {isGuest && (
                <button
                  onClick={() => setOnlyFree(v => !v)}
                  aria-pressed={onlyFree}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all flex items-center gap-1.5 ${onlyFree ? 'bg-emerald-500 text-on-accent shadow-md' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                >
                  <Check className="h-4 w-4" />
                  Свободные
                </button>
              )}
            </div>

            {(() => {
              const displayedWishes = wishes.filter(wish => {
                if (isGuest && onlyFree && wish.reservedBy) return false;
                if (activeFilter === 'all') return true;
                if (activeFilter === 'unassigned') return !wish.groupId || wish.groupId === 'unassigned';
                return wish.groupId === activeFilter;
              });

              if (!wishesLoaded) {
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
                const isReservedByMe = wish.reservedBy === user?.uid;
                const isReservedByOther = wish.reservedBy && wish.reservedBy !== user?.uid;

                return (
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
                          className="absolute top-2 right-2 p-2 bg-white/95 backdrop-blur-sm rounded-full text-red-500 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-red-50 before:content-[''] before:absolute before:-inset-2"
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
                             <p className="text-rose-600 font-bold text-sm break-words line-clamp-1">{wish.price}</p>
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
                            className="text-xs font-semibold text-gray-500 hover:text-rose-500 flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            В магазин
                          </a>
                        ) : (
                          <div /> // Spacer
                        )}

                        {!isMine ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleReserve(wish); }}
                            disabled={isReservedByOther}
                            className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm ${
                              isReservedByMe
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                                : isReservedByOther
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed shadow-none'
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
                );
              });
            })()}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="flex flex-col items-center justify-center text-center mt-24 px-6">
            <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
              <Sparkles className="h-12 w-12 text-rose-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">В разработке</h2>
            <p className="text-base text-gray-500">Скоро здесь появятся идеи подарков.</p>
          </div>
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
                        className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                      >
                        Вишлист
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleReserve(wish); }}
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
                  <img src={tgUser.photo_url} alt="Profile" className="h-full w-full object-cover" />
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
                    {new Date(userProfile.birthdate).toLocaleDateString('ru-RU')}
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
                <span className="font-bold text-xl text-emerald-600">
                  {reservedWishes.length}
                </span>
              </button>
            </div>

            <div className="mt-4 bg-white p-6 rounded-sheet shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-lg">Интересы</h3>
                <button
                  onClick={openInterests}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {userProfile?.interests?.length ? 'Изменить' : 'Выбрать'}
                </button>
              </div>
              {userProfile?.interests?.length ? (
                <div className="flex flex-wrap gap-2">
                  {userProfile.interests.map(name => (
                    <span key={name} className="bg-rose-50 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100">
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
                    className={`py-2.5 rounded-2xl text-sm font-semibold transition-all ${themePref === value ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-600'}`}
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
        onClick={closeAddModal} 
      />
      
      {/* Add Modal Bottom Sheet */}
      <div className={`absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out max-h-[90dvh] overflow-y-auto custom-scrollbar ${isAddModalOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />

          <button
            onClick={closeAddModal}
            aria-label="Закрыть"
            className="absolute top-6 right-6 p-2.5 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
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
                required
                maxLength={200}
                value={newWish.title}
                onChange={(e) => setNewWish({...newWish, title: e.target.value})}
                className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-400"
              />
            </div>

            {/* Group Selector */}
            <div className="flex flex-col gap-2 mb-2">
              <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-xs px-1">Группа желаний</label>
              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                <button
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: 'unassigned'})}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${newWish.groupId === 'unassigned' ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                >
                    Без группы
                </button>
                {groups.map(group => (
                    <button
                    key={group.id}
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: group.id})}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${newWish.groupId === group.id ? 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                    {group.name}
                    </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center gap-1.5 border-2 border-transparent"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="relative flex-1">
                <Tag className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Цена (напр. 5000₽)" 
                  maxLength={30}
                  value={newWish.price}
                  onChange={(e) => setNewWish({...newWish, price: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
              <input 
                type="url" 
                placeholder="Ссылка на товар (необязательно)" 
                value={newWish.link}
                onChange={(e) => setNewWish({...newWish, link: e.target.value})}
                className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-400"
              />
            </div>

            <textarea
              placeholder="Комментарий: размер, цвет, пожелания (необязательно)"
              rows={2}
              maxLength={500}
              value={newWish.note}
              onChange={(e) => setNewWish({...newWish, note: e.target.value})}
              className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 px-5 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-400 resize-none"
            />

            <div className="relative">
              {newWish.imageUrl ? (
                <div className="relative w-full h-32 rounded-button overflow-hidden border-2 border-gray-100 bg-gray-50">
                  <img src={newWish.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setNewWish({...newWish, imageUrl: ''})}
                    aria-label="Убрать фото"
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 text-gray-500 hover:text-red-500 transition-colors shadow-sm"
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

      {/* Floating Bottom Navigation: подписанные вкладки + отдельная кнопка «+» */}
      <div className="absolute bottom-6 left-0 right-0 z-30 px-4 flex justify-center items-center gap-3 pointer-events-none">
        <nav className="bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-gray-100 rounded-full flex-1 max-w-[280px] px-2 py-1.5 flex items-center justify-around pointer-events-auto">
          {NAV_TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { if (id === 'profile') exitGuestMode(); setActiveTab(id); }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-full transition-colors ${isActive ? 'text-rose-500' : 'text-gray-500 hover:text-gray-600'}`}
              >
                <Icon strokeWidth={isActive ? 2.5 : 2} className="h-6 w-6" />
                <span className={`text-xs leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
                {id === 'reserved' && reservedWishes.length > 0 && (
                  <span className="absolute top-0 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-accent text-xs font-bold leading-none flex items-center justify-center">
                    {reservedWishes.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => { exitGuestMode(); openAddModal(); }}
          aria-label="Добавить желание"
          className="pointer-events-auto flex-none bg-gradient-to-tr from-accent to-accent-2 h-14 w-14 rounded-full text-on-accent shadow-lg shadow-pink-200/60 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        >
          <PlusCircle className="h-7 w-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* Create Group Modal */}
      {isGroupModalOpen && (
        <div className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-sheet p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Folder className="h-6 w-6 text-rose-500" />
                  Новая группа
                </h3>
                <form onSubmit={handleAddGroup}>
                    <input 
                        type="text"
                        placeholder="Например: Мой вишлист"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-tile py-4 px-5 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold mb-3 placeholder:text-gray-400"
                        autoFocus
                    />
                    
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

                        return suggestions.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setNewGroupName(suggestion)}
                            className="bg-rose-50 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all"
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
                            disabled={!newGroupName.trim()}
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
            <div className="absolute bottom-0 left-0 right-0 z-[70] h-[90dvh] flex flex-col bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300">
              <div className="px-6 pt-5 pb-3 flex-none">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Интересы</h2>
                  <button
                    onClick={() => setIsInterestsOpen(false)}
                    aria-label="Закрыть"
                    className="p-2.5 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
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
                    className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-tile py-3 pl-12 pr-11 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-400"
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

      {/* Manage Groups Modal */}
      {isManageGroupsOpen && (
        <div
          className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setIsManageGroupsOpen(false); setRenamingGroupId(null); }}
        >
          <div
            className="bg-white rounded-sheet p-6 w-full max-w-sm max-h-[80dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
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
                className="p-2 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
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
                          className="p-2.5 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 transition-all"
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
                          className="p-2.5 rounded-full bg-white text-red-500 hover:bg-red-50 transition-colors"
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

      {/* Wish Detail Modal */}
      {selectedWishId && (() => {
        const wish = wishes.find((w) => w.id === selectedWishId) || reservedWishes.find((w) => w.id === selectedWishId);
        if (!wish) return null;
        const isMine = wish.ownerId === user?.uid;
        const isReservedByMe = wish.reservedBy === user?.uid;
        const isReservedByOther = wish.reservedBy && wish.reservedBy !== user?.uid;

        return (
          <div
            className="absolute inset-0 z-[80] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedWishId(null)}
          >
            <div
              className="bg-white rounded-sheet w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
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
                  className="absolute top-3 right-3 p-2 bg-white/95 backdrop-blur-sm rounded-full text-gray-500 shadow-sm hover:bg-gray-50"
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
                    <p className="text-rose-600 font-bold text-base break-words">{wish.price}</p>
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
                      onClick={() => toggleReserve(wish)}
                      disabled={!!isReservedByOther}
                      className={`w-full py-3.5 rounded-tile text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                        isReservedByMe
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                          : isReservedByOther
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-pink-200/50 hover:scale-[1.01] active:scale-95'
                      }`}
                    >
                      {isReservedByMe && <CheckCircle className="h-4 w-4" />}
                      {isReservedByMe ? 'Я дарю это · Снять бронь' : isReservedByOther ? 'Уже занято' : 'Подарить'}
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditModal(wish)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                      >
                        <Pencil className="h-4 w-4" />
                        Изменить
                      </button>
                      <button
                        onClick={() => deleteWish(wish)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-gray-100 text-red-500 hover:bg-red-50 active:scale-95 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </button>
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
                <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center pt-8">Ещё пара деталей</h2>
                <p className="text-gray-500 font-medium mb-10 text-center">Это поможет друзьям не забыть о вашем празднике.</p>
                
                <div className="w-full space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Дата рождения *</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-4 h-6 w-6 text-gray-500" />
                      <input 
                        type="date" 
                        value={onboardingForm.birthdate}
                        onChange={(e) => setOnboardingForm({...onboardingForm, birthdate: e.target.value})}
                        className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-button py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Пол *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Мужской', 'Женский'].map(gender => (
                        <button
                          key={gender}
                          onClick={() => setOnboardingForm({...onboardingForm, gender})}
                          className={`py-4 rounded-button font-bold border-2 transition-all ${onboardingForm.gender === gender ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          {gender}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-10 w-full pb-8">
                    <button 
                    onClick={handleCompleteOnboarding}
                    disabled={!onboardingForm.birthdate || onboardingForm.gender === 'Не указано'}
                    className="w-full bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:shadow-none active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                    <Check className="h-6 w-6" />
                    Готово
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
      <div className={`absolute bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out ${isShareModalOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          
          <button 
            onClick={() => setIsShareModalOpen(false)}
            aria-label="Закрыть"
            className="absolute top-6 right-6 p-2.5 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
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
          padding-bottom: env(safe-area-inset-bottom, 32px);
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