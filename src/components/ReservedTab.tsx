import { Heart, Gift } from 'lucide-react';
import type { Wish } from '../types';

interface ReservedTabProps {
  reservedWishes: Wish[];
  onSelectWish: (wishId: string) => void;
  onOpenFriendWishlist: (ownerId: string) => void;
  onToggleReserve: (wish: Wish, isCurrentlyReservedByMe: boolean) => void;
}

export default function ReservedTab({ reservedWishes, onSelectWish, onOpenFriendWishlist, onToggleReserve }: ReservedTabProps) {
  return (
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
            onClick={() => onSelectWish(wish.id)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelectWish(wish.id);
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
                  onClick={(e) => { e.stopPropagation(); onOpenFriendWishlist(wish.ownerId); }}
                  className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                >
                  Вишлист
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleReserve(wish, true); }}
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
  );
}
