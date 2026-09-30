import { Folder, X, Search, Check, PlusCircle, Pencil } from 'lucide-react';
import { normalizeSearch } from '../interests';
import type { Group, Wish } from '../types';

interface GroupPickerModalProps {
  query: string;
  onQueryChange: (query: string) => void;
  wishes: Wish[];
  groups: Group[];
  activeFilter: string;
  onSelectFilter: (id: string) => void;
  onClose: () => void;
  isGuest: boolean;
  onCreateGroup: () => void;
  onManageGroups: () => void;
}

export default function GroupPickerModal({
  query, onQueryChange, wishes, groups, activeFilter, onSelectFilter, onClose, isGuest, onCreateGroup, onManageGroups,
}: GroupPickerModalProps) {
  const q = normalizeSearch(query);
  const countFor = (id: string) => wishes.filter(w => (id === 'unassigned' ? (!w.groupId || w.groupId === 'unassigned') : w.groupId === id)).length;
  const rows = [
    { id: 'all', name: 'Все желания', count: wishes.length },
    { id: 'unassigned', name: 'Без группы', count: countFor('unassigned') },
    ...groups.map(g => ({ id: g.id, name: g.name, count: countFor(g.id) })),
  ].filter(r => !q || normalizeSearch(r.name).includes(q));

  return (
    <div
      className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
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
            onClick={onClose}
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
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
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
                  onClick={() => onSelectFilter(row.id)}
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
              onClick={onCreateGroup}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-tile text-sm font-bold bg-rose-50 text-accent-text hover:bg-rose-100 active:scale-95 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Создать
            </button>
            <button
              onClick={onManageGroups}
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
}
