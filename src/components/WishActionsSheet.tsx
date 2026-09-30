import { X, FolderInput, Copy } from 'lucide-react';
import type { Group, Wish } from '../types';

interface WishActionsSheetProps {
  wish: Wish;
  groups: Group[];
  mode: 'move' | 'copy';
  onModeChange: (mode: 'move' | 'copy') => void;
  onClose: () => void;
  onMove: (wish: Wish, groupId: string) => void;
  onDuplicate: (wish: Wish, groupId: string) => void;
}

export default function WishActionsSheet({
  wish, groups, mode, onModeChange, onClose, onMove, onDuplicate,
}: WishActionsSheetProps) {
  const currentGroup = wish.groupId || 'unassigned';
  const rows = [{ id: 'unassigned', name: 'Без группы' }, ...groups.map(g => ({ id: g.id, name: g.name }))];

  return (
    <>
      <div className="absolute inset-0 z-[90] bg-black/45 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
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
              <h3 className="text-xl font-bold text-gray-900">{mode === 'move' ? 'Перенести в группу' : 'Дублировать в группу'}</h3>
              <p className="text-sm font-medium text-gray-600 truncate mt-0.5">{wish.title}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="flex-none h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            {([['move', 'Перенести', FolderInput], ['copy', 'Дублировать', Copy]] as const).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                aria-pressed={mode === m}
                className={`flex-1 flex items-center justify-center gap-2 min-h-11 rounded-tile text-sm font-bold transition-all active:scale-95 ${
                  mode === m ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
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
              const disabled = mode === 'move' && isCurrent;
              return (
                <li key={row.id}>
                  <button
                    onClick={() => mode === 'move' ? onMove(wish, row.id) : onDuplicate(wish, row.id)}
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
}
