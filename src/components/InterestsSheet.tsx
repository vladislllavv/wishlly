import { X, Search, XCircle, Loader2, Check } from 'lucide-react';
import { INTEREST_CATEGORIES, normalizeSearch } from '../interests';

interface InterestsSheetProps {
  query: string;
  onQueryChange: (query: string) => void;
  draft: string[];
  onToggleInterest: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function InterestsSheet({
  query, onQueryChange, draft, onToggleInterest, onClose, onSave, isSaving,
}: InterestsSheetProps) {
  const q = normalizeSearch(query);
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
        onClick={onClose}
      />
      <div role="dialog"
  data-overlay="interests"
  tabIndex={-1} aria-modal="true" aria-label="Интересы" className="outline-none absolute bottom-0 left-0 right-0 z-[70] h-[90dvh] flex flex-col bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300">
        <div className="px-6 pt-5 pb-3 flex-none">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Интересы</h2>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
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
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent text-gray-900 rounded-tile py-3 pl-12 pr-11 outline-none focus:border-rose-200 focus:bg-white transition-all font-semibold placeholder:font-medium placeholder:text-gray-500"
            />
            {query && (
              <button
                onClick={() => onQueryChange('')}
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
                    const selected = draft.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => onToggleInterest(item)}
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
            onClick={onSave}
            disabled={isSaving}
            className="w-full mb-3 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button py-4 shadow-lg shadow-pink-200/50 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isSaving ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Check className="h-6 w-6" />
                {draft.length ? `Сохранить (${draft.length})` : 'Сохранить'}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
