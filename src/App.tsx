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
import CreateGroupModal from './components/CreateGroupModal';
import InterestsSheet from './components/InterestsSheet';
import GroupPickerModal from './components/GroupPickerModal';
import ManageGroupsModal from './components/ManageGroupsModal';
import WishActionsSheet from './components/WishActionsSheet';
import WishDetailModal from './components/WishDetailModal';
import ShareModal from './components/ShareModal';
import AddWishModal from './components/AddWishModal';
import { EMPTY_WISH } from './wishForm';
import OnboardingScreen, { MIN_ONBOARDING_INTERESTS } from './components/OnboardingScreen';
import ReservedTab from './components/ReservedTab';
import ProfileTab from './components/ProfileTab';
import HomeTab from './components/HomeTab';
import ConfirmDialog from './components/ConfirmDialog';
import { groupKey, GROUP_NAME_MAX } from './groupUtils';
import { getThemePreference, setThemePreference, type ThemePreference } from './theme';
import type { Wish, Group, Profile, GuestView, Friendship } from './types';
export type { Group, Profile } from './types';
import {
  getTelegramInitData, parseStartParam, inertWhen, focusableIn, tgSupports, openExternal,
} from './telegramUtils';
import { isSafeLink, normalizeLink, linkProblem, describeParseLinkFailure } from './linkUtils';
import {
  formatPrice, currencyFromCode, todayISO, birthdateProblem, formatBirthdate, daysUntilBirthday, birthdayLabel,
  MIN_BIRTH_YEAR,
} from './formatUtils';
import {
  auth, db, appId, botUsername, signInWithTelegram, describeAuthError, type FirebaseUser,
} from './firebaseClient';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, writeBatch, query, where } from 'firebase/firestore';

// Вкладка «Рекомендации» скрыта, пока не готова (сейчас там заглушка «В разработке»)
const SHOW_RECOMMENDATIONS = true;

const NAV_TABS = [
  { id: 'home', label: 'Главная', Icon: Home },
  { id: 'reserved', label: 'Я дарю', Icon: Heart },
  ...(SHOW_RECOMMENDATIONS ? [{ id: 'recommendations', label: 'Идеи', Icon: Sparkles }] : []),
  { id: 'profile', label: 'Профиль', Icon: User },
];


export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tgUser, setTgUser] = useState<any>(null); // Telegram User Data
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [reservedWishes, setReservedWishes] = useState<Wish[]>([]); // брони текущего пользователя в любых вишлистах
  // Вишлисты, к которым пользователь присоединился («Друзья»), и профили их владельцев (имя, дата рождения)
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, Profile | null>>({});
  const friendActionInFlight = useRef(new Set<string>());
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
  const [toastAction, setToastAction] = useState<{ label: string; run: () => void } | null>(null);
  const [toastIsError, setToastIsError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Wish Detail State
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null);

  // Пока не пришёл первый снапшот — показываем скелетоны, а не «Здесь пока пусто»
  const [wishesLoaded, setWishesLoaded] = useState(false);

  // action — необязательная кнопка в тосте («Показать», «Отменить»); с ней тост висит дольше
  const showToast = (message: string, isError = false, action?: { label: string; run: () => void }) => {
    clearTimeout(toastTimer.current);
    setToastMessage(message);
    setToastIsError(isError);
    setToastAction(action ?? null);
    toastTimer.current = setTimeout(() => { setToastMessage(''); setToastAction(null); }, action ? 6000 : 3000);
    if (tgSupports('6.1')) window.Telegram.WebApp.HapticFeedback?.notificationOccurred(isError ? 'error' : 'success');
  };

  // Нативное подтверждение Telegram, в обычном браузере — свой неблокирующий диалог
  // (window.confirm() блокировал бы всю страницу целиком, включая тосты и анимации)
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (message: string, onConfirm: () => void) => {
    const tg = window.Telegram?.WebApp;
    // showConfirm появился в Bot API 6.2; SDK-объект есть и в обычном браузере, но метод там кидает ошибку
    if (tg?.showConfirm && tgSupports('6.2')) {
      tg.showConfirm(message, (confirmed) => { if (confirmed) onConfirm(); });
    } else {
      setConfirmState({ message, onConfirm });
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
      interests: wish.interests || [],
      shareToIdeas: wish.shareToIdeas === true,
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

  // Вишлисты, к которым присоединился текущий пользователь
  useEffect(() => {
    if (!user) {
      setFriendships([]);
      return;
    }
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'friendships');
    return onSnapshot(
      query(ref, where('friendId', '==', user.uid)),
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setFriendships(list);
      },
      (error) => console.error('Error fetching friendships:', error)
    );
  }, [user]);

  // Профили друзей подгружаем разово по мере появления новых связей
  useEffect(() => {
    const missing = friendships.map(f => f.ownerId).filter(id => !(id in friendProfiles));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map(async (ownerId) => {
      try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', ownerId));
        return [ownerId, snap.exists() ? (snap.data() as Profile) : null] as const;
      } catch (error) {
        console.error('Error fetching friend profile:', error);
        return [ownerId, null] as const;
      }
    })).then((pairs) => {
      if (!cancelled) setFriendProfiles(prev => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => { cancelled = true; };
  }, [friendships, friendProfiles]);

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
    if (interestsDraft.length < MIN_ONBOARDING_INTERESTS) return;
    setIsSavingProfile(true);
    try {
      const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
      await setDoc(profileRef, {
        birthdate: onboardingForm.birthdate,
        gender: onboardingForm.gender,
        firstName: tgUser?.first_name || '',
        interests: interestsDraft,
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
        interests: newWish.interests,
        shareToIdeas: newWish.shareToIdeas,
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
          ownerInterests: userProfile?.interests || [],
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

  const friendshipRef = (ownerId: string) =>
    doc(db, 'artifacts', appId, 'public', 'data', 'friendships', `${ownerId}_${user!.uid}`);

  // «Присоединиться» к вишлисту друга: владелец попадает в «Друзья» в профиле
  const joinWishlist = async (ownerId: string) => {
    if (!user || ownerId === user.uid || friendActionInFlight.current.has(ownerId)) return;
    friendActionInFlight.current.add(ownerId);
    try {
      await setDoc(friendshipRef(ownerId), { ownerId, friendId: user.uid, createdAt: Date.now() });
      showToast('Вы присоединились к вишлисту. Друг появится в профиле, в «Друзьях».');
    } catch (error) {
      console.error('Error joining wishlist:', error);
      showToast('Не удалось присоединиться. Попробуйте ещё раз.', true);
    } finally {
      friendActionInFlight.current.delete(ownerId);
    }
  };

  const leaveWishlist = async (ownerId: string) => {
    if (!user || friendActionInFlight.current.has(ownerId)) return;
    friendActionInFlight.current.add(ownerId);
    try {
      await deleteDoc(friendshipRef(ownerId));
      showToast('Вы отписались от вишлиста');
    } catch (error) {
      console.error('Error leaving wishlist:', error);
      showToast('Не удалось отписаться. Попробуйте ещё раз.', true);
    } finally {
      friendActionInFlight.current.delete(ownerId);
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
        // Снимок для «Отменить»: тот же id, поэтому вернётся и бронь друга (она лежит в отдельной коллекции по id желания)
        const { id: _id, ...snapshot } = wish;
        showToast('Желание удалено', false, {
          label: 'Отменить',
          run: async () => {
            try {
              await setDoc(wishRef, snapshot);
              showToast('Желание восстановлено');
            } catch (error) {
              console.error("Error restoring wish:", error);
              showToast('Не удалось восстановить желание', true);
            }
          },
        });
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
      // При фильтре другой группы карточка из текущего списка исчезает — говорим об этом и даём перейти к ней
      const leftCurrentList = activeFilter !== 'all' && activeFilter !== groupId;
      showToast(
        leftCurrentList ? `Перенесено в «${groupTitle(groupId)}» — в этом списке её больше нет` : `Перенесено в «${groupTitle(groupId)}»`,
        false,
        leftCurrentList ? { label: 'Показать', run: () => setActiveFilter(groupId) } : undefined
      );
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
        ownerInterests: userProfile?.interests || [],
        createdAt: Date.now(),
      });
      const hiddenByFilter = activeFilter !== 'all' && activeFilter !== groupId;
      showToast(
        `Копия создана в «${groupTitle(groupId)}»`,
        false,
        hiddenByFilter ? { label: 'Показать', run: () => setActiveFilter(groupId) } : undefined
      );
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
  if (confirmState) backAction = () => setConfirmState(null);
  else if (showOnboarding && !isGuest) backAction = onboardingStep === 3 ? () => setOnboardingStep(2) : onboardingStep === 2 ? () => setOnboardingStep(1) : null;
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
  const topOverlay = confirmState ? 'confirm'
    : actionWishId ? 'wish-actions'
    : isInterestsOpen ? 'interests'
    : isGroupPickerOpen ? 'group-picker'
    : isGroupModalOpen ? 'group-create'
    : isManageGroupsOpen ? 'group-manage'
    : selectedWishId ? 'detail'
    : isShareModalOpen ? 'share'
    : isAddModalOpen ? 'add'
    : null;
  const openOverlayCount = [!!confirmState, !!actionWishId, isInterestsOpen, isGroupPickerOpen, isGroupModalOpen, isManageGroupsOpen, !!selectedWishId, isShareModalOpen, isAddModalOpen].filter(Boolean).length;
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
  const hasOpenOverlay = !!confirmState || !!actionWishId || isInterestsOpen || isGroupPickerOpen || isGroupModalOpen || isManageGroupsOpen
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
          <HomeTab
            isGuest={isGuest}
            ownerNotFound={ownerNotFound}
            guestView={guestView}
            groups={groups}
            wishes={wishes}
            ownerProfile={ownerProfile}
            reservationsByWishId={reservationsByWishId}
            wishesLoaded={wishesLoaded}
            groupsLoaded={groupsLoaded}
            ownerProfileState={ownerProfileState}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            groupChipsRef={groupChipsRef}
            onManageGroup={(group) => { setIsManageGroupsOpen(true); setRenamingGroupId(group.id); setRenameValue(group.name); }}
            onCreateGroup={() => setIsGroupModalOpen(true)}
            onlyFree={onlyFree}
            onToggleOnlyFree={() => setOnlyFree(v => !v)}
            onOpenGroupPicker={() => { setGroupPickerQuery(''); setIsGroupPickerOpen(true); }}
            swipeHintVisible={swipeHintVisible}
            onDismissSwipeHint={dismissSwipeHint}
            onExitGuestMode={exitGuestMode}
            isFriend={friendships.some(f => f.ownerId === viewedOwnerId)}
            onJoin={() => viewedOwnerId && joinWishlist(viewedOwnerId)}
            onOpenAddModal={openAddModal}
            userId={user?.uid}
            onDeleteWish={deleteWish}
            onOpenWishActions={openWishActions}
            onSelectWish={setSelectedWishId}
            onToggleReserve={toggleReserve}
          />
        )}

        {activeTab === 'recommendations' && (
          <IdeaSwipeStack
            db={db}
            appId={appId}
            user={user}
            interests={userProfile?.interests || []}
            groups={groups}
            ownerName={tgUser?.first_name}
            showToast={showToast}
          />
        )}

        {activeTab === 'reserved' && (
          <ReservedTab
            reservedWishes={reservedWishes}
            onSelectWish={setSelectedWishId}
            onOpenFriendWishlist={openFriendWishlist}
            onToggleReserve={toggleReserve}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            tgUser={tgUser}
            userProfile={userProfile}
            wishes={wishes}
            userId={user?.uid}
            reservedCount={reservedWishes.length}
            onGoToReserved={() => setActiveTab('reserved')}
            onOpenInterests={openInterests}
            friends={friendships.map(f => ({ ownerId: f.ownerId, profile: friendProfiles[f.ownerId] }))}
            onOpenFriend={openFriendWishlist}
            onLeaveFriend={leaveWishlist}
            themePref={themePref}
            onThemeChange={handleThemeChange}
          />
        )}
      </main>

      <AddWishModal
        isOpen={isAddModalOpen}
        editingWishId={editingWishId}
        newWish={newWish}
        setNewWish={setNewWish}
        autoFilledRef={autoFilledRef}
        groups={groups}
        interestOptions={userProfile?.interests || []}
        onCreateGroup={() => setIsGroupModalOpen(true)}
        linkInputRef={linkInputRef}
        linkTouched={linkTouched}
        onLinkBlur={() => setLinkTouched(true)}
        onParseLink={handleParseLink}
        isParsingLink={isParsingLink}
        isImageProcessing={isImageProcessing}
        onImageUpload={handleImageUpload}
        nativeMain={nativeMain}
        isSubmitting={isSubmitting}
        onSubmit={handleAddWish}
        onRequestClose={requestCloseAddModal}
      />

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
        <CreateGroupModal
          newGroupName={newGroupName}
          onNewGroupNameChange={setNewGroupName}
          onSubmit={handleAddGroup}
          onCancel={() => setIsGroupModalOpen(false)}
          groupNameError={groupNameError}
          userGender={userProfile?.gender}
        />
      )}

      {/* Interests Sheet */}
      {isInterestsOpen && (
        <InterestsSheet
          query={interestsQuery}
          onQueryChange={setInterestsQuery}
          draft={interestsDraft}
          onToggleInterest={toggleInterest}
          onClose={() => setIsInterestsOpen(false)}
          onSave={saveInterests}
          isSaving={isSavingInterests}
        />
      )}

      {/* Group Picker Modal */}
      {isGroupPickerOpen && (
        <GroupPickerModal
          query={groupPickerQuery}
          onQueryChange={setGroupPickerQuery}
          wishes={wishes}
          groups={groups}
          activeFilter={activeFilter}
          onSelectFilter={(id) => { setActiveFilter(id); setIsGroupPickerOpen(false); }}
          onClose={() => setIsGroupPickerOpen(false)}
          isGuest={isGuest}
          onCreateGroup={() => { setIsGroupPickerOpen(false); setIsGroupModalOpen(true); }}
          onManageGroups={() => { setIsGroupPickerOpen(false); setIsManageGroupsOpen(true); }}
        />
      )}

      {/* Manage Groups Modal */}
      {isManageGroupsOpen && (
        <ManageGroupsModal
          groups={groups}
          renamingGroupId={renamingGroupId}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onStartRename={(group) => { setRenamingGroupId(group.id); setRenameValue(group.name); }}
          onCancelRename={() => setRenamingGroupId(null)}
          onSubmitRename={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
          onClose={() => { setIsManageGroupsOpen(false); setRenamingGroupId(null); }}
        />
      )}

      {/* Wish Actions Sheet: перенести в другую группу / сделать копию */}
      {actionWishId && (() => {
        const wish = wishes.find(w => w.id === actionWishId);
        if (!wish) return null;
        return (
          <WishActionsSheet
            wish={wish}
            groups={groups}
            mode={actionMode}
            onModeChange={setActionMode}
            onClose={() => setActionWishId(null)}
            onMove={moveWish}
            onDuplicate={duplicateWish}
          />
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
          <WishDetailModal
            wish={wish}
            isMine={isMine}
            isReservedByMe={isReservedByMe}
            isReservedByOther={isReservedByOther}
            onClose={() => setSelectedWishId(null)}
            onToggleReserve={toggleReserve}
            onEdit={openEditModal}
            onDelete={deleteWish}
            onOpenActions={openWishActions}
          />
        );
      })()}

      {/* Onboarding / Welcome Screen Overlay */}
      {showOnboarding && !isGuest && (
        <OnboardingScreen
          step={onboardingStep}
          onStepChange={setOnboardingStep}
          form={onboardingForm}
          onFormChange={setOnboardingForm}
          interestsQuery={interestsQuery}
          onInterestsQueryChange={setInterestsQuery}
          interestsDraft={interestsDraft}
          onToggleInterest={toggleInterest}
          onComplete={handleCompleteOnboarding}
          isSavingProfile={isSavingProfile}
        />
      )}

      {/* Share Selection Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        groups={groups}
        onShare={handleShare}
      />

      {/* Confirm Dialog: замена window.confirm() вне Telegram */}
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={() => { const { onConfirm } = confirmState; setConfirmState(null); onConfirm(); }}
          onCancel={() => setConfirmState(null)}
        />
      )}

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
            {toastAction && (
              <button
                onClick={() => { const run = toastAction.run; clearTimeout(toastTimer.current); setToastMessage(''); setToastAction(null); run(); }}
                className="ml-1 -my-1.5 -mr-2 min-h-11 px-3 rounded-full text-rose-300 font-bold hover:bg-white/10 active:scale-95 transition-all"
              >
                {toastAction.label}
              </button>
            )}
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