import type React from 'react';
import { Folder, X, Check, Pencil, Trash2 } from 'lucide-react';
import type { Group } from '../types';

interface ManageGroupsModalProps {
  groups: Group[];
  renamingGroupId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: (group: Group) => void;
  onCancelRename: () => void;
  onSubmitRename: (group: Group) => void;
  onDeleteGroup: (e: React.MouseEvent, group: Group) => void;
  onClose: () => void;
}

export default function ManageGroupsModal({
  groups, renamingGroupId, renameValue, onRenameValueChange, onStartRename, onCancelRename, onSubmitRename, onDeleteGroup, onClose,
}: ManageGroupsModalProps) {
  return (
    <div
      className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
    data-overlay="group-manage"
    tabIndex={-1}
        aria-modal="true"
        aria-label="Мои группы"
        className="outline-none bg-white rounded-sheet p-6 w-full max-w-sm max-h-[80dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Folder className="h-6 w-6 text-rose-500" />
            Мои группы
          </h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="text-gray-500 font-medium py-4 text-center">Групп пока нет.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map(group => (
              <li key={group.id} className="flex items-center gap-2 bg-gray-50 rounded-tile p-2 pl-4">
                {renamingGroupId === group.id ? (
                  <form
                    className="flex flex-1 min-w-0 items-center gap-2"
                    onSubmit={(e) => { e.preventDefault(); onSubmitRename(group); }}
                  >
                    <input
                      autoFocus
                      maxLength={100}
                      value={renameValue}
                      onChange={(e) => onRenameValueChange(e.target.value)}
                      className="flex-1 min-w-0 bg-white border-2 border-rose-200 text-gray-900 rounded-2xl py-2 px-3 outline-none font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={!renameValue.trim()}
                      aria-label="Сохранить название"
                      className="p-2.5 rounded-full bg-emerald-50 text-success-text hover:bg-emerald-100 disabled:opacity-50 transition-all"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onCancelRename}
                      aria-label="Отменить переименование"
                      className="p-2.5 rounded-full bg-white text-gray-500 hover:bg-gray-100 transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 truncate font-semibold text-gray-900">{group.name}</span>
                    <button
                      onClick={() => onStartRename(group)}
                      aria-label={`Переименовать группу ${group.name}`}
                      className="p-2.5 rounded-full bg-white text-gray-500 hover:text-rose-500 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => onDeleteGroup(e, group)}
                      aria-label={`Удалить группу ${group.name}`}
                      className="p-2.5 rounded-full bg-white text-danger-text hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
