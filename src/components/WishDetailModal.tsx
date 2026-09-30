import { Gift, X, ExternalLink, CheckCircle, Pencil, Trash2, FolderInput, Copy } from 'lucide-react';
import type React from 'react';
import type { Wish } from '../types';
import { isSafeLink } from '../linkUtils';
import { openExternal } from '../telegramUtils';

interface WishDetailModalProps {
  wish: Wish;
  isMine: boolean;
  isReservedByMe: boolean;
  isReservedByOther: boolean;
  onClose: () => void;
  onToggleReserve: (wish: Wish, isCurrentlyReservedByMe: boolean) => void;
  onEdit: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
  onOpenActions: (wishId: string, mode: 'move' | 'copy') => void;
}

export default function WishDetailModal({
  wish, isMine, isReservedByMe, isReservedByOther, onClose, onToggleReserve, onEdit, onDelete, onOpenActions,
}: WishDetailModalProps) {
  return (
    <div
      className="absolute inset-0 z-[80] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
    data-overlay="detail"
    tabIndex={-1}
        aria-modal="true"
        aria-label={wish.title}
        className="outline-none bg-white rounded-sheet w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
            onClick={onClose}
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
              onClick={(e) => openExternal(e, wish.link!)}
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
                onClick={() => onToggleReserve(wish, isReservedByMe)}
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
                  onClick={() => onEdit(wish)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-rose-50 text-accent-text border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all"
                >
                  <Pencil className="h-4 w-4" />
                  Изменить
                </button>
                <button
                  onClick={() => onDelete(wish)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-gray-100 text-danger-text hover:bg-red-50 active:scale-95 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              </div>
              {/* То же, что смахивание карточки вправо, — для тех, кому жест неудобен */}
              <div className="flex gap-3">
                <button
                  onClick={() => onOpenActions(wish.id, 'move')}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-tile text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                >
                  <FolderInput className="h-4 w-4" />
                  Перенести
                </button>
                <button
                  onClick={() => onOpenActions(wish.id, 'copy')}
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
}
