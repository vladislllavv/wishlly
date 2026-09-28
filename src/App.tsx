import React, { useState, useEffect } from 'react';
import { 
  Gift, PlusCircle, Home, ExternalLink, CheckCircle, 
  User, X, Link as LinkIcon, Image as ImageIcon, 
  Tag, Heart, Sparkles, Loader2, Trash2, Send,
  Camera, XCircle, Folder, Calendar, ArrowRight, Check, Share2, Copy
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, query, where } from 'firebase/firestore';

interface Wish {
  id: string;
  title: string;
  price?: string;
  link?: string;
  imageUrl?: string;
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
  onboardingCompleted?: boolean;
  createdAt?: number;
}

interface GuestView {
  ownerId: string;
  groupId: string | null;
}

// start_param из ссылки «Поделиться»: "<uid>" или "<uid>-<groupId>".
// Разделитель "-": uid вида tg_123 содержит "_", а id документов Firestore и uid не содержат "-".
function parseStartParam(): GuestView | null {
  const tg = window.Telegram?.WebApp;
  const raw =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(window.location.search).get('tgWebAppStartParam');
  if (!raw || !/^[A-Za-z0-9_-]{1,64}$/.test(raw)) return null;
  const [ownerId, groupId] = raw.split('-');
  return ownerId ? { ownerId, groupId: groupId || null } : null;
}

// Открываем только http(s)-ссылки — защита от javascript: и прочих схем
function isSafeLink(link?: string): boolean {
  return !!link && /^https?:\/\//i.test(link);
}

// Firebase Configuration & Initialization (значения берутся из .env / Vercel Environment Variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'wishforyou-tma-id';
const botUsername = import.meta.env.VITE_BOT_USERNAME || 'wishlly_bot';

// Обменивает подписанный Telegram initData на Firebase custom token (см. api/auth.ts)
async function fetchTelegramAuthToken(initData: string): Promise<string> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok) throw new Error(`Auth request failed: ${res.status}`);
  const { token } = await res.json();
  return token;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tgUser, setTgUser] = useState<any>(null); // Telegram User Data
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [reservedByMeCount, setReservedByMeCount] = useState(0);
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'profile'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Guest mode: просмотр чужого вишлиста по ссылке «Поделиться»
  const [guestView, setGuestView] = useState<GuestView | null>(parseStartParam);

  // Profile & Onboarding State
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingForm, setOnboardingForm] = useState({ birthdate: '', gender: 'Не указано' });

  // Form State
  const [newWish, setNewWish] = useState({ title: '', price: '', link: '', imageUrl: '', groupId: 'unassigned' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  // Groups State
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeFilter, setActiveFilter] = useState(guestView?.groupId || 'all');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Share State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Wish Detail State
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Initialize Telegram WebApp if available
    const initTelegram = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand(); // Expand to full screen in TG
        if (tg.initDataUnsafe?.user) {
          setTgUser(tg.initDataUnsafe.user);
        }
      }
    };
    initTelegram();

    // 2. Initialize Firebase Auth
    const initAuth = async () => {
      const initData = window.Telegram?.WebApp?.initData;
      try {
        if (initData) {
          // Внутри Telegram: стабильный uid вида tg_<id>, одинаковый на всех устройствах.
          // Без фолбэка на анонимный вход — иначе пользователь молча получит чужой пустой профиль.
          await signInWithCustomToken(auth, await fetchTelegramAuthToken(initData));
        } else {
          // Обычный браузер (локальная разработка)
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setAuthError(true);
        setIsLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Чей вишлист показываем: владельца из ссылки (режим гостя) или свой
  const isGuest = !!user && !!guestView && guestView.ownerId !== user.uid;
  const viewedOwnerId = isGuest ? guestView.ownerId : user?.uid;

  const exitGuestMode = () => {
    setGuestView(null);
    setActiveFilter('all');
  };

  useEffect(() => {
    if (!user || !viewedOwnerId) return;

    // Real-time listener: только желания просматриваемого владельца
    const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');

    const unsubscribeWishes = onSnapshot(query(wishesRef, where('ownerId', '==', viewedOwnerId)), (snapshot) => {
      const wishesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as Wish);
      // Sort newest first
      wishesData.sort((a, b) => b.createdAt - a.createdAt);
      setWishes(wishesData);
    }, (error) => {
      console.error("Error fetching wishes:", error);
    });

    // Real-time listener for groups collection
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

    // Real-time listener for user profile settings
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

    // Счётчик «Я дарю» — брони текущего пользователя в любых вишлистах
    const unsubscribeReserved = onSnapshot(
      query(wishesRef, where('reservedBy', '==', user.uid)),
      (snapshot) => setReservedByMeCount(snapshot.size),
      (error) => console.error("Error fetching reservations:", error)
    );

    return () => {
      unsubscribeWishes();
      unsubscribeGroups();
      unsubscribeProfile();
      unsubscribeReserved();
    };
  }, [user, viewedOwnerId]);

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
        onboardingCompleted: true,
        createdAt: Date.now()
      });
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;
    try {
      const groupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'groups');
      await addDoc(groupsRef, {
        name: newGroupName.trim(),
        ownerId: user.uid,
        createdAt: Date.now()
      });
      setNewGroupName('');
      setIsGroupModalOpen(false);
    } catch (error) {
      console.error("Error adding group:", error);
    }
  };

  const handleAddWish = async (e) => {
    e.preventDefault();
    if (!newWish.title.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');
      await addDoc(wishesRef, {
        ...newWish,
        ownerId: user.uid,
        ownerName: tgUser?.first_name || 'Anonymous', // Store TG name if available
        reservedBy: null,
        createdAt: Date.now()
      });
      setNewWish({ title: '', price: '', link: '', imageUrl: '', groupId: 'unassigned' });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding wish:", error);
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
    } catch (error) {
      console.error("Error updating reservation:", error);
    }
  };

  const deleteWish = async (wishId) => {
    if (!user) return;
    try {
      const wishRef = doc(db, 'artifacts', appId, 'public', 'data', 'wishes', wishId);
      await deleteDoc(wishRef);
    } catch (error) {
      console.error("Error deleting wish:", error);
    }
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
        setToastMessage('Ссылка скопирована!');
        setTimeout(() => setToastMessage(''), 3000);
      } catch (err) {
        console.error('Ошибка копирования', err);
      }
      document.body.removeChild(tempTextArea);
    }
    setIsShareModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFC]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center h-16 w-16">
            <div className="absolute inset-0 border-4 border-rose-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-rose-500 rounded-full border-t-transparent animate-spin"></div>
            <Gift className="h-6 w-6 text-rose-500 animate-pulse" />
          </div>
          <p className="text-gray-500 font-medium tracking-wide animate-pulse">Загрузка магии...</p>
        </div>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFC] px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">Не удалось войти</h2>
          <p className="text-gray-500 font-medium">Проверьте соединение и попробуйте ещё раз.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold rounded-[24px] px-8 py-3.5 shadow-lg shadow-pink-200/50 active:scale-[0.98] transition-all"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col h-screen bg-[#FAFAFC] shadow-2xl relative overflow-hidden font-sans sm:border-x sm:border-gray-200 text-gray-900 selection:bg-rose-100">
      
      {/* Top Header (Glassmorphism) */}
      <header className="flex-none bg-white/80 backdrop-blur-xl border-b border-gray-100 px-5 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-rose-500 to-pink-400 p-2 rounded-2xl shadow-sm shadow-rose-200">
            <Gift className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
            WISHLLY
          </h1>
        </div>
        
        {tgUser && (
          <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-100 shadow-sm">
            <span className="text-sm font-bold text-gray-700">
              {tgUser.first_name}
            </span>
          </div>
        )}
      </header>

      <main className="flex-grow overflow-y-auto pb-32 pt-5 px-4 custom-scrollbar">
        {activeTab === 'home' && (
          <div className="space-y-4">

            {/* Guest banner: чужой вишлист, открытый по ссылке */}
            {isGuest && (
              <div className="flex items-center justify-between gap-3 bg-rose-50 border border-rose-100 rounded-[20px] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Вишлист друга</p>
                  <p className="font-extrabold text-gray-900 truncate">{wishes[0]?.ownerName || 'Пока без желаний'}</p>
                </div>
                <button
                  onClick={exitGuestMode}
                  className="whitespace-nowrap px-3.5 py-2 rounded-2xl text-xs font-extrabold bg-white text-rose-500 border border-rose-100 hover:bg-rose-100 transition-all"
                >
                  Мой вишлист
                </button>
              </div>
            )}

            {/* Categories Horizontal Scroll */}
            <div className="flex overflow-x-auto gap-2 pb-2 mb-2 custom-scrollbar">
              <button
                onClick={() => setActiveFilter('all')}
                className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
              >
                Все
              </button>
              <button
                onClick={() => setActiveFilter('unassigned')}
                className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeFilter === 'unassigned' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
              >
                Без группы
              </button>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveFilter(group.id)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeFilter === group.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
                >
                  {group.name}
                </button>
              ))}
              {!isGuest && (
                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              )}
            </div>

            {(() => {
              const displayedWishes = wishes.filter(wish => {
                if (activeFilter === 'all') return true;
                if (activeFilter === 'unassigned') return !wish.groupId || wish.groupId === 'unassigned';
                return wish.groupId === activeFilter;
              });

              if (displayedWishes.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center text-center mt-20 text-gray-400 px-6">
                    <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
                      {activeFilter === 'all' ? (
                        <Heart className="h-12 w-12 text-rose-300 fill-rose-100" />
                      ) : (
                        <Folder className="h-12 w-12 text-rose-300 fill-rose-100" />
                      )}
                    </div>
                    <h3 className="text-2xl font-extrabold text-gray-800 mb-2">Здесь пока пусто</h3>
                    <p className="text-base text-gray-500">
                      {activeFilter === 'all' 
                        ? 'Добавьте свое первое желание, чтобы друзья знали, чем вас порадовать!'
                        : 'В этой группе еще нет желаний.'}
                    </p>
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
                    onClick={() => setSelectedWishId(wish.id)}
                    className="bg-white rounded-[28px] p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 flex gap-4 transition-all hover:shadow-md relative group cursor-pointer"
                  >
                    {/* Image Thumbnail */}
                    <div className="h-28 w-28 flex-shrink-0 rounded-[20px] overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-50 relative">
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
                          onClick={(e) => { e.stopPropagation(); deleteWish(wish.id); }}
                          className="absolute top-2 right-2 p-2 bg-white/95 backdrop-blur-sm rounded-full text-red-500 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Wish Details */}
                    <div className="flex flex-col flex-grow min-w-0 justify-between py-1.5 pr-1">
                      <div>
                        <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 text-[16px] break-words">
                          {wish.title}
                        </h3>
                        {wish.price && (
                          <div className="inline-block max-w-full mt-2 bg-rose-50 px-2.5 py-1 rounded-lg">
                             <p className="text-rose-600 font-extrabold text-sm break-words line-clamp-1">{wish.price}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {isSafeLink(wish.link) ? (
                          <a
                            href={wish.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-gray-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
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
                            className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all duration-300 flex items-center gap-1.5 shadow-sm ${
                              isReservedByMe
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                                : isReservedByOther
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                  : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-pink-200/50 hover:shadow-md hover:scale-[1.02] active:scale-95'
                            }`}
                          >
                            {isReservedByMe && <CheckCircle className="h-3.5 w-3.5" />}
                            {isReservedByMe ? 'Я дарю!' : isReservedByOther ? 'Занято' : 'Подарить'}
                          </button>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-xl">
                            Ваше желание
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
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
              <div className="absolute top-0 -inset-1 bg-gradient-to-r from-rose-400 to-pink-400 rounded-full blur opacity-30 animate-pulse"></div>
            </div>
            
            <h2 className="text-2xl font-extrabold text-gray-900">
              {tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}` : 'Мой Профиль'}
            </h2>
            <p className="text-sm text-gray-400 mt-1 font-mono bg-gray-100 px-3 py-1 rounded-lg">
              ID: {user?.uid.substring(0, 8)}
            </p>

            {/* Profile Info Display */}
            {userProfile && (
              <div className="flex gap-4 mt-4">
                {userProfile.birthdate && (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gray-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                    <Calendar className="h-4 w-4 text-rose-400" />
                    {new Date(userProfile.birthdate).toLocaleDateString('ru-RU')}
                  </div>
                )}
                {userProfile.gender && userProfile.gender !== 'Не указано' && (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gray-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    <User className="h-4 w-4 text-indigo-400" />
                    {userProfile.gender}
                  </div>
                )}
              </div>
            )}
            
            {/* Исправленный блок статистики */}
            <div className="mt-8 bg-white p-6 rounded-[32px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 w-full">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Статистика</h3>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-[20px] mb-3">
                <span className="text-gray-500 font-medium">Мои желания</span>
                <span className="font-extrabold text-xl text-rose-500">
                  {wishes.filter(w => w.ownerId === user?.uid).length}
                </span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-[20px]">
                <span className="text-gray-500 font-medium">Я дарю</span>
                <span className="font-extrabold text-xl text-emerald-600">
                  {reservedByMeCount}
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="mt-8 flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-4 rounded-[24px] font-extrabold w-full transition-all hover:shadow-lg hover:shadow-pink-200/50 active:scale-[0.98]"
            >
              <Send className="h-5 w-5" />
              Поделиться вишлистом
            </button>
          </div>
        )}
      </main>

      {/* Add Modal Overlay */}
      <div 
        className={`absolute inset-0 z-40 bg-gray-900/20 backdrop-blur-sm transition-opacity duration-300 ${isAddModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
        onClick={() => setIsAddModalOpen(false)} 
      />
      
      {/* Add Modal Bottom Sheet */}
      <div className={`absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out ${isAddModalOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
          
          <button 
            onClick={() => setIsAddModalOpen(false)}
            className="absolute top-6 right-6 p-2.5 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Новое желание ✨</h2>
          
          <form onSubmit={handleAddWish} className="space-y-4">
            
            {/* Group Selector */}
            <div className="flex flex-col gap-2 mb-2">
              <label className="text-sm font-bold text-gray-400 uppercase tracking-wider text-[11px] px-1">Группа желаний</label>
              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                <button
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: 'unassigned'})}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${newWish.groupId === 'unassigned' ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                >
                    Без группы
                </button>
                {groups.map(group => (
                    <button
                    key={group.id}
                    type="button"
                    onClick={() => setNewWish({...newWish, groupId: group.id})}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${newWish.groupId === group.id ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                    {group.name}
                    </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setTimeout(() => setIsGroupModalOpen(true), 300); }}
                  className="whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-bold bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center gap-1.5 border-2 border-transparent"
                >
                  <PlusCircle className="h-4 w-4" />
                  Создать
                </button>
              </div>
            </div>

            <div className="relative">
              <Gift className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
              <input 
                type="text"
                placeholder="Что вы хотите?"
                required
                maxLength={200}
                value={newWish.title}
                onChange={(e) => setNewWish({...newWish, title: e.target.value})}
                className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-[24px] py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-bold placeholder:font-medium placeholder:text-gray-400"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Tag className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Цена (напр. 5000₽)" 
                  value={newWish.price}
                  onChange={(e) => setNewWish({...newWish, price: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-[24px] py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-bold placeholder:font-medium placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
              <input 
                type="url" 
                placeholder="Ссылка на товар (необязательно)" 
                value={newWish.link}
                onChange={(e) => setNewWish({...newWish, link: e.target.value})}
                className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-[24px] py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-bold placeholder:font-medium placeholder:text-gray-400"
              />
            </div>

            <div className="relative">
              {newWish.imageUrl ? (
                <div className="relative w-full h-32 rounded-[24px] overflow-hidden border-2 border-gray-100 bg-gray-50">
                  <img src={newWish.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setNewWish({...newWish, imageUrl: ''})}
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 text-gray-500 hover:text-red-500 transition-colors shadow-sm"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-[24px] bg-gray-50 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer group">
                  {isImageProcessing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500 mb-2" />
                  ) : (
                    <Camera className="h-6 w-6 text-gray-400 mb-2 group-hover:text-rose-400 transition-colors" />
                  )}
                  <span className="text-sm font-bold text-gray-400 group-hover:text-rose-400 transition-colors">
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

            <button 
              type="submit" 
              disabled={isSubmitting || isImageProcessing || !newWish.title.trim()}
              className="w-full mt-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold rounded-[24px] py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-6 w-6" />
                  Сохранить в вишлист
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Floating Bottom Navigation (Modern Glassmorphism) */}
      <div className="absolute bottom-6 left-0 right-0 z-30 px-6 flex justify-center pointer-events-none">
        <nav className="bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-gray-100 rounded-full px-6 py-2 flex items-center gap-10 pointer-events-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`p-3 transition-all duration-300 flex items-center justify-center ${activeTab === 'home' ? 'text-rose-500 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Home strokeWidth={activeTab === 'home' ? 2.5 : 2} className="h-6 w-6" />
          </button>

          <button 
            onClick={() => { exitGuestMode(); setIsAddModalOpen(true); }}
            className="bg-gradient-to-tr from-rose-500 to-pink-500 h-14 w-14 rounded-full text-white shadow-lg shadow-pink-200/60 hover:scale-105 active:scale-95 transition-all -mt-8 border-[4px] border-[#FAFAFC] flex items-center justify-center relative z-10"
          >
            <PlusCircle className="h-7 w-7" strokeWidth={2.5} />
          </button>

          <button 
            onClick={() => { exitGuestMode(); setActiveTab('profile'); }}
            className={`p-3 transition-all duration-300 flex items-center justify-center ${activeTab === 'profile' ? 'text-rose-500 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <User strokeWidth={activeTab === 'profile' ? 2.5 : 2} className="h-6 w-6" />
          </button>
        </nav>
      </div>

      {/* Create Group Modal */}
      {isGroupModalOpen && (
        <div className="absolute inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                  <Folder className="h-6 w-6 text-rose-500" />
                  Новая группа
                </h3>
                <form onSubmit={handleAddGroup}>
                    <input 
                        type="text"
                        placeholder="Например: Мой вишлист"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-[20px] py-4 px-5 outline-none focus:border-rose-200 focus:bg-white transition-all font-bold mb-3 placeholder:text-gray-400"
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
                            className="bg-rose-50 text-rose-600 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-rose-100 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all"
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
                            className="flex-1 bg-gray-100 text-gray-600 font-bold py-3.5 rounded-[20px] hover:bg-gray-200 transition-colors"
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit"
                            disabled={!newGroupName.trim()}
                            className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold py-3.5 rounded-[20px] shadow-lg shadow-pink-200/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
                        >
                            Создать
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Wish Detail Modal */}
      {selectedWishId && (() => {
        const wish = wishes.find((w) => w.id === selectedWishId);
        if (!wish) return null;
        const isMine = wish.ownerId === user?.uid;
        const isReservedByMe = wish.reservedBy === user?.uid;
        const isReservedByOther = wish.reservedBy && wish.reservedBy !== user?.uid;

        return (
          <div
            className="absolute inset-0 z-[80] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedWishId(null)}
          >
            <div
              className="bg-white rounded-[32px] w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
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
                  className="absolute top-3 right-3 p-2 bg-white/95 backdrop-blur-sm rounded-full text-gray-500 shadow-sm hover:bg-gray-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-extrabold text-gray-900 break-words leading-snug">
                  {wish.title}
                </h3>

                {wish.price && (
                  <div className="inline-block max-w-full mt-3 bg-rose-50 px-3 py-1.5 rounded-lg">
                    <p className="text-rose-600 font-extrabold text-base break-words">{wish.price}</p>
                  </div>
                )}

                {isSafeLink(wish.link) && (
                  <a
                    href={wish.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-rose-500 transition-colors break-all"
                  >
                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    {wish.link}
                  </a>
                )}

                <div className="mt-6">
                  {!isMine ? (
                    <button
                      onClick={() => toggleReserve(wish)}
                      disabled={!!isReservedByOther}
                      className={`w-full py-3.5 rounded-[20px] text-sm font-extrabold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                        isReservedByMe
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                          : isReservedByOther
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-pink-200/50 hover:scale-[1.01] active:scale-95'
                      }`}
                    >
                      {isReservedByMe && <CheckCircle className="h-4 w-4" />}
                      {isReservedByMe ? 'Я дарю это!' : isReservedByOther ? 'Уже занято' : 'Подарить'}
                    </button>
                  ) : (
                    <span className="block text-center text-xs font-extrabold uppercase tracking-widest text-gray-400 bg-gray-50 py-3 rounded-[20px]">
                      Ваше желание
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Onboarding / Welcome Screen Overlay */}
      {showOnboarding && (
        <div className="absolute inset-0 z-[100] bg-white flex flex-col overflow-y-auto animate-in fade-in duration-300 pb-safe custom-scrollbar">
          <div className="flex-1 px-6 pt-12 flex flex-col items-center">
            {onboardingStep === 1 ? (
              <div className="flex flex-col items-center text-center max-w-sm w-full animate-in slide-in-from-right-8 duration-300 h-full">
                <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-100 to-pink-100 flex items-center justify-center shadow-inner mb-8 border-4 border-white">
                  <Gift className="h-14 w-14 text-rose-500" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-4 leading-tight">Добро пожаловать в WISHLLY! ✨</h2>
                <p className="text-gray-500 font-medium mb-10 text-lg">Ваш идеальный список желаний, которым хочется делиться.</p>
                
                <div className="space-y-6 text-left w-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-50 p-3.5 rounded-2xl">
                      <Gift className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-lg">Добавляйте желания</h4>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">Сохраняйте все, что хотите получить в подарок.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-50 p-3.5 rounded-2xl">
                      <Folder className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-lg">Сортируйте по поводам</h4>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">Разделяйте подарки на День рождения, Новый год и т.д.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-50 p-3.5 rounded-2xl">
                      <CheckCircle className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-lg">Тайная бронь</h4>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">Друзья могут занять подарок, а для вас это останется сюрпризом!</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-10 w-full pb-8">
                    <button 
                    onClick={() => setOnboardingStep(2)}
                    className="w-full bg-gray-900 text-white font-extrabold rounded-[24px] py-4 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                    Продолжить <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full max-w-sm animate-in slide-in-from-right-8 duration-300 h-full">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-3 text-center pt-8">Ещё пара деталей</h2>
                <p className="text-gray-500 font-medium mb-10 text-center">Это поможет друзьям не забыть о вашем празднике.</p>
                
                <div className="w-full space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Дата рождения *</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
                      <input 
                        type="date" 
                        value={onboardingForm.birthdate}
                        onChange={(e) => setOnboardingForm({...onboardingForm, birthdate: e.target.value})}
                        className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-[24px] py-4 pl-14 pr-4 outline-none focus:border-rose-200 focus:bg-white transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Пол *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Мужской', 'Женский'].map(gender => (
                        <button
                          key={gender}
                          onClick={() => setOnboardingForm({...onboardingForm, gender})}
                          className={`py-4 rounded-[24px] font-extrabold border-2 transition-all ${onboardingForm.gender === gender ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
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
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold rounded-[24px] py-4 shadow-lg shadow-pink-200/50 transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:shadow-none active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                    <Check className="h-6 w-6" />
                    Войти
                    </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Selection Modal */}
      <div 
        className={`absolute inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${isShareModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
        onClick={() => setIsShareModalOpen(false)} 
      />
      <div className={`absolute bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-400 transform ease-out ${isShareModalOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-7 relative pb-safe">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          
          <button 
            onClick={() => setIsShareModalOpen(false)}
            className="absolute top-6 right-6 p-2.5 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <h2 className="text-2xl font-extrabold text-gray-900 mb-6 flex items-center gap-2">
             <Share2 className="h-6 w-6 text-rose-500" />
             Поделиться
          </h2>

          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
             <button 
                onClick={() => handleShare('all', 'Все желания')}
                className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-gray-50 hover:bg-rose-50 transition-colors border-2 border-transparent hover:border-rose-100 group text-left"
             >
                <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:text-rose-500 text-gray-400 transition-colors">
                   <Gift className="h-6 w-6" />
                </div>
                <div>
                   <h4 className="font-extrabold text-gray-900 text-lg">Все желания</h4>
                   <p className="text-sm font-medium text-gray-500">Отправить общий список</p>
                </div>
             </button>

             {groups.map(group => (
                <button 
                  key={group.id}
                  onClick={() => handleShare(group.id, group.name)}
                  className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-gray-50 hover:bg-rose-50 transition-colors border-2 border-transparent hover:border-rose-100 group text-left"
               >
                  <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:text-rose-500 text-gray-400 transition-colors">
                     <Folder className="h-6 w-6" />
                  </div>
                  <div>
                     <h4 className="font-extrabold text-gray-900 text-lg">{group.name}</h4>
                     <p className="text-sm font-medium text-gray-500">Только из этой группы</p>
                  </div>
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
         <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
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
      `}</style>
    </div>
  );
}