import type React from 'react';
import { Folder } from 'lucide-react';
import { GROUP_NAME_MAX } from '../groupUtils';

interface CreateGroupModalProps {
  newGroupName: string;
  onNewGroupNameChange: (name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  groupNameError: (name: string) => string | null;
  userGender: string | undefined;
}

export default function CreateGroupModal({
  newGroupName, onNewGroupNameChange, onSubmit, onCancel, groupNameError, userGender,
}: CreateGroupModalProps) {
  const error = groupNameError(newGroupName);

  return (
    <div className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
        <div role="dialog"
    data-overlay="group-create"
    tabIndex={-1} aria-modal="true" aria-label="Новая группа" className="outline-none bg-white rounded-sheet p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Folder className="h-6 w-6 text-rose-500" />
              Новая группа
            </h3>
            <form onSubmit={onSubmit}>
                <input
                    type="text"
                    placeholder="Например: Мой вишлист"
                    aria-label="Название группы"
                    aria-invalid={!!error}
                    maxLength={GROUP_NAME_MAX}
                    value={newGroupName}
                    onChange={(e) => onNewGroupNameChange(e.target.value)}
                    className={`w-full bg-gray-50 border-2 text-gray-900 rounded-tile py-4 px-5 outline-none focus:bg-white transition-all font-semibold placeholder:text-gray-500 ${error ? 'border-red-300 focus:border-red-400 mb-1.5' : 'border-transparent focus:border-rose-200 mb-3'}`}
                    autoFocus
                />
                {error && (
                  <p role="alert" className="mb-3 px-2 text-sm font-medium text-danger-text">{error}</p>
                )}

                {/* Быстрые подсказки */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {(() => {
                    const suggestions = ['День рождения 🥳', 'Новый год 🎄'];

                    if (userGender === 'Мужской') {
                      suggestions.push('23 Февраля 🛡️');
                    } else if (userGender === 'Женский') {
                      suggestions.push('8 Марта 🌷');
                    } else {
                      // Фолбэк, если пол по какой-то причине не был указан
                      suggestions.push('8 Марта 🌷', '23 Февраля 🛡️');
                    }

                    suggestions.push('Свадьба 💍');

                    // Уже созданные группы не предлагаем повторно
                    return suggestions.filter(suggestion => !groupNameError(suggestion)).map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onNewGroupNameChange(suggestion)}
                        className="bg-rose-50 text-accent-text text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all"
                      >
                        {suggestion}
                      </button>
                    ));
                  })()}
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-tile hover:bg-gray-200 transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={!newGroupName.trim() || !!error}
                        className="flex-1 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-semibold py-3.5 rounded-tile shadow-lg shadow-pink-200/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
                    >
                        Создать
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
}
