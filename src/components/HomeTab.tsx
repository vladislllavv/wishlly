import type React from 'react';
import { Folder, PlusCircle, Check, Pencil, Link as LinkIcon, Heart, Gift, ExternalLink, CheckCircle, Trash2 } from 'lucide-react';
import type { Group, GuestView, Profile, Wish } from '../types';
import { isSafeLink } from '../linkUtils';
import { openExternal, tgSupports } from '../telegramUtils';
import { daysUntilBirthday, birthdayLabel } from '../formatUtils';
import SwipeRow from './SwipeRow';

interface HomeTabProps {
  isGuest: boolean;
  ownerNotFound: boolean;
  guestView: GuestView | null;
  groups: Group[];
  wishes: Wish[];
  ownerProfile: Profile | null;
  reservationsByWishId: Record<string, string | null>;
  wishesLoaded: boolean;
  groupsLoaded: boolean;
  ownerProfileState: 'loading' | 'found' | 'missing' | 'error';
  activeFilter: string;
  onSelectFilter: (id: string) => void;
  groupChipsRef: React.RefObject<HTMLDivElement>;
  onManageGroup: (group: Group) => void;
  onCreateGroup: () => void;
  onlyFree: boolean;
  onToggleOnlyFree: () => void;
  onOpenGroupPicker: () => void;
  swipeHintVisible: boolean;
  onDismissSwipeHint: () => void;
  onExitGuestMode: () => void;
  isFriend: boolean;
  onJoin: () => void;
  onOpenAddModal: () => void;
  userId: string | undefined;
  onDeleteWish: (wish: Wish) => void;
  onOpenWishActions: (wishId: string) => void;
  onSelectWish: (wishId: string) => void;
  onToggleReserve: (wish: Wish, isCurrentlyReservedByMe: boolean) => void;
}

export default function HomeTab({
  isGuest, ownerNotFound, guestView, groups, wishes, ownerProfile, reservationsByWishId,
  wishesLoaded, groupsLoaded, ownerProfileState, activeFilter, onSelectFilter, groupChipsRef,
  onManageGroup, onCreateGroup, onlyFree, onToggleOnlyFree, onOpenGroupPicker,
  swipeHintVisible, onDismissSwipeHint, onExitGuestMode, isFriend, onJoin, onOpenAddModal, userId,
  onDeleteWish, onOpenWishActions, onSelectWish, onToggleReserve,
}: HomeTabProps) {
  return (
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
                onClick={onExitGuestMode}
                className="whitespace-nowrap px-3.5 py-2 min-h-11 rounded-2xl text-xs font-bold bg-white text-accent-text border border-rose-100 hover:bg-rose-100 transition-all"
              >
                Мой вишлист
              </button>
            </div>
            {isFriend ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-success-text">
                <Check className="h-4 w-4" />
                Вы присоединились. Друг есть в профиле, в «Друзьях»
              </p>
            ) : (
              <button
                onClick={onJoin}
                className="w-full min-h-11 rounded-2xl text-sm font-bold bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-lg shadow-pink-200/50 hover:shadow-xl active:scale-[0.98] transition-all"
              >
                Присоединиться
              </button>
            )}
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
          onClick={() => onSelectFilter('all')}
          aria-pressed={activeFilter === 'all'}
          data-active-chip={activeFilter === 'all'}
          className={`sticky left-0 z-10 whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold transition-all ${activeFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}
        >
          Все
        </button>
        <button
          onClick={() => onSelectFilter('unassigned')}
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
                onClick={() => onSelectFilter(group.id)}
                aria-pressed={isActive}
                className={`whitespace-nowrap py-2.5 min-h-11 pl-4 ${canEdit ? 'pr-2' : 'pr-4'}`}
              >
                {group.name}
              </button>
              {canEdit && (
                // Правка активной группы прямо на её «таблетке»: переименовать или удалить
                <button
                  onClick={() => onManageGroup(group)}
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
            onClick={onCreateGroup}
            className="whitespace-nowrap px-4 py-2.5 min-h-11 rounded-2xl text-sm font-semibold bg-rose-50 text-accent-text hover:bg-rose-100 transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            Создать
          </button>
        )}
        {isGuest && (
          <button
            onClick={onToggleOnlyFree}
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
        onClick={onOpenGroupPicker}
        aria-label="Все группы"
        className="flex-none flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Folder className="h-5 w-5" />
      </button>
      </div>
      )}

      {!isGuest && swipeHintVisible && wishesLoaded && wishes.some(w => activeFilter === 'all'
        || (activeFilter === 'unassigned' ? (!w.groupId || w.groupId === 'unassigned') : w.groupId === activeFilter)) && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-tile pl-4 pr-1.5 py-1.5">
          <p className="flex-1 text-xs font-semibold text-gray-600">Смахните желание: влево — удалить, вправо — перенести или дублировать</p>
          <button
            onClick={onDismissSwipeHint}
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
                onClick={onExitGuestMode}
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
                  onClick={onOpenAddModal}
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
          const isMine = wish.ownerId === userId;
          const reservedBy = reservationsByWishId[wish.id] ?? null;
          const isReservedByMe = reservedBy === userId;
          const isReservedByOther = !!reservedBy && reservedBy !== userId;

          return (
            <SwipeRow
              key={wish.id}
              enabled={isMine && !isGuest}
              onSwipeLeft={() => onDeleteWish(wish)}
              onSwipeRight={() => onOpenWishActions(wish.id)}
              onArm={() => { if (tgSupports('6.1')) window.Telegram.WebApp.HapticFeedback?.impactOccurred('light'); }}
            >
            <div
              role="button"
              tabIndex={0}
              aria-label={`Открыть желание: ${wish.title}`}
              onClick={() => onSelectWish(wish.id)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectWish(wish.id);
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
                    onClick={(e) => { e.stopPropagation(); onDeleteWish(wish); }}
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
                      onClick={(e) => { e.stopPropagation(); openExternal(e, wish.link!); }}
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
                      onClick={(e) => { e.stopPropagation(); onToggleReserve(wish, isReservedByMe); }}
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
  );
}
