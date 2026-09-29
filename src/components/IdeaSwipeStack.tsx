import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, PlusCircle, Heart, X, Folder, Check, ChevronDown } from 'lucide-react';
import {
  collection, doc, setDoc, addDoc, getDocs, query, where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { pickIdeasForInterests, type GiftIdea } from '../giftIdeas';
import type { Group } from '../App';
import { groupKey, GROUP_NAME_MAX } from '../groupUtils';

interface IdeaSwipeStackProps {
  db: Firestore;
  appId: string;
  user: FirebaseUser | null;
  interests: string[];
  groups: Group[];
  ownerName?: string;
}

const SWIPE_THRESHOLD = 100;
const UNASSIGNED = 'unassigned';

// Хранит решения like/dislike по идеям подарков — сигнал для будущих рекомендаций.
// Путь совпадает с остальными данными приложения: artifacts/{appId}/public/data/{collection}
function swipesCollection(db: Firestore, appId: string) {
  return collection(db, 'artifacts', appId, 'public', 'data', 'giftSwipes');
}

export default function IdeaSwipeStack({ db, appId, user, interests, groups, ownerName }: IdeaSwipeStackProps) {
  // Куда попадает «Хочу». По умолчанию — «Без группы» ('unassigned', как в остальном приложении):
  // можно свайпать сразу, а группу выбирают кнопкой-папкой, если нужно
  const [selectedGroupId, setSelectedGroupId] = useState<string>(UNASSIGNED);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Только что созданная группа: выбираем её сразу, а в списке groups она появится чуть позже (пришлёт подписка)
  const justCreatedGroupId = useRef<string | null>(null);

  // Выбранную группу удалили — возвращаемся к «Без группы»
  useEffect(() => {
    if (selectedGroupId === UNASSIGNED) return;
    const exists = groups.some((g) => g.id === selectedGroupId);
    if (selectedGroupId === justCreatedGroupId.current) {
      if (exists) justCreatedGroupId.current = null;
      return;
    }
    if (!exists) setSelectedGroupId(UNASSIGNED);
  }, [groups, selectedGroupId]);

  const targetGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const targetName = targetGroup ? targetGroup.name : 'Без группы';

  const deck = useMemo(() => pickIdeasForInterests(interests), [interests]);
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null);
  const [cursor, setCursor] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const dragStartX = useRef(0);
  const decisionLock = useRef(false); // ref, а не state: два вызова в одном тике не должны оба пройти
  // Текст для скринридера: что произошло после решения (карточка исчезает, само по себе это не озвучивается)
  const [announcement, setAnnouncement] = useState('');

  // При открытии вкладки подтягиваем уже просмотренные пользователем идеи, чтобы не показывать их повторно
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSeenIds(new Set());
      return;
    }
    getDocs(query(swipesCollection(db, appId), where('userId', '==', user.uid)))
      .then((snap) => {
        if (cancelled) return;
        setSeenIds(new Set(snap.docs.map((d) => d.data().ideaId as string)));
      })
      .catch((error) => {
        console.warn('Не удалось загрузить историю свайпов:', error);
        if (!cancelled) setSeenIds(new Set());
      });
    return () => { cancelled = true; };
  }, [db, appId, user]);

  const remaining = useMemo(() => {
    if (!seenIds) return [];
    return deck.filter((idea) => !seenIds.has(idea.id));
  }, [deck, seenIds]);

  const current = remaining[cursor];
  const next = remaining[cursor + 1];

  const newGroupError = newGroupName.trim() && groups.some((g) => groupKey(g.name) === groupKey(newGroupName))
    ? 'Группа с таким названием уже есть'
    : null;

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || !user || creatingGroup || newGroupError) return;
    setCreatingGroup(true);
    try {
      const groupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'groups');
      const created = await addDoc(groupsRef, {
        name: newGroupName.trim(),
        ownerId: user.uid,
        createdAt: Date.now(),
      });
      justCreatedGroupId.current = created.id;
      setSelectedGroupId(created.id);
      setNewGroupName('');
      setIsPickerOpen(false);
    } catch (error) {
      console.warn('Не удалось создать группу:', error);
    } finally {
      setCreatingGroup(false);
    }
  }

  function recordSwipe(idea: GiftIdea, liked: boolean) {
    if (!user) return;
    const ref = doc(swipesCollection(db, appId), `${user.uid}_${idea.id}`);
    setDoc(ref, { userId: user.uid, ideaId: idea.id, liked, createdAt: Date.now() }).catch((error) => {
      console.warn('Не удалось сохранить решение по идее подарка:', error);
    });

    if (liked) {
      const wishesRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishes');
      addDoc(wishesRef, {
        title: idea.title,
        price: idea.price,
        priceAmount: null,
        priceCurrency: '₽',
        link: '',
        imageUrl: '',
        note: '',
        groupId: selectedGroupId,
        ownerId: user.uid,
        ownerName: ownerName || 'Anonymous',
        createdAt: Date.now(),
      }).catch((error) => {
        console.warn('Не удалось добавить идею в группу как желание:', error);
      });
    }
  }

  function commitSwipe(direction: 'left' | 'right') {
    // exitDirection: пока карточка улетает, повторное нажатие не должно записать решение дважды и пропустить следующую идею
    if (!current || exitDirection || decisionLock.current) return;
    decisionLock.current = true;
    setExitDirection(direction);
    recordSwipe(current, direction === 'right');
    setAnnouncement(direction === 'right'
      ? `«${current.title}» добавлено ${targetGroup ? `в группу «${targetGroup.name}»` : 'в желания без группы'}`
      : `«${current.title}» пропущено`);
    window.setTimeout(() => {
      setCursor((c) => c + 1);
      setDragX(0);
      setExitDirection(null);
      decisionLock.current = false;
    }, 200);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (exitDirection) return;
    setDragging(true);
    dragStartX.current = e.clientX;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragX(e.clientX - dragStartX.current);
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragX > SWIPE_THRESHOLD) {
      commitSwipe('right');
    } else if (dragX < -SWIPE_THRESHOLD) {
      commitSwipe('left');
    } else {
      setDragX(0);
    }
  }

  // Клавиатура: → «хочу», ← «не хочу». Не перехватываем стрелки в полях ввода и пока открыто окно
  const commitSwipeRef = useRef(commitSwipe);
  commitSwipeRef.current = commitSwipe;
  const canDecide = !!current;
  const canDecideRef = useRef(canDecide);
  canDecideRef.current = canDecide;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([inert]):not([aria-hidden="true"])')) return;
      if (!canDecideRef.current) return;
      e.preventDefault();
      commitSwipeRef.current(e.key === 'ArrowRight' ? 'right' : 'left');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const rotation = dragX / 12;
  const cardStyle: React.CSSProperties = exitDirection
    ? {
        transform: `translateX(${exitDirection === 'right' ? 600 : -600}px) rotate(${exitDirection === 'right' ? 30 : -30}deg)`,
        opacity: 0,
        transition: 'transform 200ms ease-out, opacity 200ms ease-out',
      }
    : {
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: dragging ? 'none' : 'transform 200ms ease-out',
      };

  // ---- Окно выбора группы ----
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openPicker() {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNewGroupName('');
    setIsPickerOpen(true);
  }
  function closePicker() {
    setIsPickerOpen(false);
  }

  // Фокус: внутрь окна при открытии, обратно на кнопку-папку при закрытии; Tab ходит по кругу; Escape закрывает
  useEffect(() => {
    if (!isPickerOpen) return;
    const sheet = sheetRef.current;
    const trigger = triggerRef.current;
    const focusables = () => sheet
      ? [...sheet.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')].filter((el) => !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0)
      : [];
    const raf = requestAnimationFrame(() => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      // На тач-экране фокус на само окно, чтобы не выскочила клавиатура
      (coarse ? sheet : focusables().find((el) => el.getAttribute('aria-pressed') === 'true') || sheet)?.focus({ preventScroll: true });
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!sheet?.contains(active) || (e.shiftKey && (active === first || active === sheet))) {
        e.preventDefault(); (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isPickerOpen]);

  const pickerRows = [{ id: UNASSIGNED, name: 'Без группы' }, ...groups.map((g) => ({ id: g.id, name: g.name }))];

  // Кнопка-папка: показывает, куда попадёт «Хочу», и открывает выбор группы
  const targetButton = (
    <button
      type="button"
      onClick={openPicker}
      aria-haspopup="dialog"
      aria-label={`Группа для добавления: ${targetName}. Изменить`}
      className="mt-4 flex items-center gap-2 max-w-full min-h-11 px-4 rounded-2xl bg-white border border-gray-100 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
    >
      <Folder className="h-5 w-5 flex-none text-accent-text" />
      <span className="truncate">{targetName}</span>
      <ChevronDown className="h-4 w-4 flex-none text-gray-500" />
    </button>
  );

  const pickerSheet = isPickerOpen && (
    <>
      <div className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm animate-in fade-in duration-200" onClick={closePicker} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Куда добавлять идеи"
        tabIndex={-1}
        className="outline-none absolute bottom-0 left-0 right-0 z-[70] max-h-[85dvh] overflow-y-auto bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300 custom-scrollbar"
      >
        <div className="p-7 pb-10">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Folder className="h-6 w-6 text-rose-500" />
              Куда добавлять
            </h3>
            <button
              type="button"
              onClick={closePicker}
              aria-label="Закрыть"
              className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="space-y-1.5">
            {pickerRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedGroupId(row.id); closePicker(); }}
                  aria-pressed={selectedGroupId === row.id}
                  className={`w-full flex items-center gap-3 min-h-11 rounded-tile px-4 py-3 text-left font-semibold transition-all active:scale-[0.99] ${
                    selectedGroupId === row.id ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate">{row.name}</span>
                  {selectedGroupId === row.id && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleCreateGroup} className="mt-5">
            <label htmlFor="ideas-new-group" className="block text-sm font-semibold text-gray-600 mb-2">Новая группа</label>
            <div className="flex items-start gap-2">
              <input
                id="ideas-new-group"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={GROUP_NAME_MAX}
                placeholder="Например: Отпуск"
                aria-invalid={!!newGroupError}
                className={`flex-1 min-w-0 min-h-11 bg-gray-50 border-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:bg-white ${newGroupError ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-rose-200'}`}
              />
              <button
                type="submit"
                disabled={!newGroupName.trim() || creatingGroup || !!newGroupError}
                className="whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold bg-rose-50 text-accent-text hover:bg-rose-100 disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Создать
              </button>
            </div>
            {newGroupError && <p role="alert" className="mt-1.5 px-2 text-sm font-medium text-danger-text">{newGroupError}</p>}
          </form>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col items-center px-1 min-h-[calc(100vh-220px)]">
      <div className="px-1 self-start mb-2">
        <h2 className="text-2xl font-bold text-gray-900">Идеи</h2>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Свайпайте или нажимайте кнопки — понравившееся добавится в «{targetName}».
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center w-full">
        {seenIds === null ? (
          <Loader2 className="h-8 w-8 text-rose-300 animate-spin" />
        ) : !current ? (
          <div className="flex flex-col items-center justify-center text-center px-6">
            <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 flex items-center justify-center mb-6 shadow-inner">
              <Sparkles className="h-12 w-12 text-rose-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Идеи закончились</h2>
            <p className="text-base text-gray-500">Загляните позже — мы добавим новые идеи подарков.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
          <div className="relative w-full max-w-sm h-[min(420px,44dvh)]">
            {next && (
              <div className="absolute inset-0 bg-white rounded-card shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-gray-100 scale-95 opacity-70" />
            )}
            <div
              className={`absolute inset-0 bg-white rounded-card shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col items-center justify-center px-6 touch-none select-none ${
                'cursor-grab active:cursor-grabbing'
              }`}
              style={cardStyle}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="text-7xl mb-6">{current.emoji}</div>
              <h3 className="text-xl font-bold text-gray-900 text-center leading-snug mb-2">{current.title}</h3>
              <p className="text-sm font-semibold text-gray-500">{current.price}</p>

              {dragX > 30 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-2xl border-4 border-emerald-400 text-success-text font-black text-xl -rotate-12">
                  ХОЧУ
                </div>
              )}
              {dragX < -30 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-2xl border-4 border-gray-400 text-gray-600 font-black text-xl rotate-12">
                  НЕ ХОЧУ
                </div>
              )}
            </div>
          </div>

          {/* Те же решения без жеста — для клавиатуры, скринридера и тех, кому неудобно свайпать */}
          <div className="mt-4 flex items-start justify-center gap-10">
            <button
              type="button"
              onClick={() => commitSwipe('left')}
              disabled={!canDecide || !!exitDirection}
              aria-label={`Не хочу: ${current.title}`}
              className="flex flex-col items-center gap-1.5 min-w-16 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 shadow-md">
                <X className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <span aria-hidden="true" className="text-sm font-semibold text-gray-600">Не хочу</span>
            </button>
            <button
              type="button"
              onClick={() => commitSwipe('right')}
              disabled={!canDecide || !!exitDirection}
              aria-label={`Хочу: ${current.title}`}
              className="flex flex-col items-center gap-1.5 min-w-16 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-lg shadow-pink-200/50">
                <Heart className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <span aria-hidden="true" className="text-sm font-semibold text-accent-text">Хочу</span>
            </button>
          </div>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {targetButton}
      {pickerSheet}
    </div>
  );
}
