import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, PlusCircle } from 'lucide-react';
import {
  collection, doc, setDoc, addDoc, getDocs, query, where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { pickIdeasForInterests, type GiftIdea } from '../giftIdeas';
import type { Group } from '../App';

interface IdeaSwipeStackProps {
  db: Firestore;
  appId: string;
  user: FirebaseUser | null;
  interests: string[];
  groups: Group[];
  ownerName?: string;
}

const SWIPE_THRESHOLD = 100;

// Хранит решения like/dislike по идеям подарков — сигнал для будущих рекомендаций.
// Путь совпадает с остальными данными приложения: artifacts/{appId}/public/data/{collection}
function swipesCollection(db: Firestore, appId: string) {
  return collection(db, 'artifacts', appId, 'public', 'data', 'giftSwipes');
}

export default function IdeaSwipeStack({ db, appId, user, interests, groups, ownerName }: IdeaSwipeStackProps) {
  // Группа-цель для лайков. По умолчанию — первая группа пользователя, чтобы можно было
  // свайпать сразу, не заходя отдельно на выбор; чип с нужной группой переключается на лету.
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    if (selectedGroupId && groups.some((g) => g.id === selectedGroupId)) return;
    if (groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  const deck = useMemo(() => pickIdeasForInterests(interests), [interests]);
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null);
  const [cursor, setCursor] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const dragStartX = useRef(0);

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

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || !user || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const groupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'groups');
      const created = await addDoc(groupsRef, {
        name: newGroupName.trim(),
        ownerId: user.uid,
        createdAt: Date.now(),
      });
      setSelectedGroupId(created.id);
      setNewGroupName('');
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

    if (liked && selectedGroupId) {
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
    if (!current) return;
    setExitDirection(direction);
    recordSwipe(current, direction === 'right');
    window.setTimeout(() => {
      setCursor((c) => c + 1);
      setDragX(0);
      setExitDirection(null);
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

  // Панель групп внизу — всегда видна вместе с карточками, переключение на лету, без отдельного экрана
  const groupBar = (
    <div className="w-full flex overflow-x-auto gap-2 pt-4 pb-1 px-1 custom-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => setSelectedGroupId(group.id)}
          className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
            selectedGroupId === group.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          {group.name}
        </button>
      ))}
      <form onSubmit={handleCreateGroup} className="flex-shrink-0 flex items-center gap-2">
        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Новая группа"
          className="w-32 bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <button
          type="submit"
          disabled={!newGroupName.trim() || creatingGroup}
          aria-label="Создать группу"
          className="whitespace-nowrap px-4 py-2.5 rounded-2xl text-sm font-semibold bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
        >
          {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Создать
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col items-center px-1 min-h-[calc(100vh-220px)]">
      <div className="px-1 self-start mb-2">
        <h2 className="text-2xl font-bold text-gray-900">Идеи</h2>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {selectedGroupId ? 'Свайпайте — понравившееся упадёт в выбранную группу.' : 'Создайте группу ниже, чтобы начать.'}
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
          <div className="relative w-full max-w-sm h-[420px]">
            {next && (
              <div className="absolute inset-0 bg-white rounded-card shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-gray-100 scale-95 opacity-70" />
            )}
            <div
              className={`absolute inset-0 bg-white rounded-card shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col items-center justify-center px-6 touch-none select-none ${
                selectedGroupId ? 'cursor-grab active:cursor-grabbing' : 'opacity-60 pointer-events-none'
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-2xl border-4 border-emerald-400 text-emerald-500 font-black text-xl -rotate-12">
                  ХОЧУ
                </div>
              )}
              {dragX < -30 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-2xl border-4 border-gray-400 text-gray-500 font-black text-xl rotate-12">
                  НЕ ХОЧУ
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {groupBar}
    </div>
  );
}
