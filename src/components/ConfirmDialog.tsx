import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Замена window.confirm() в обычном браузере (вне Telegram, где есть tg.showConfirm):
// нативный confirm() блокирует весь рендер страницы, включая CDP/автоматизацию и анимации тостов,
// пока пользователь не ответит — на его месте нужен обычный React-оверлей.
export default function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="absolute inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="alertdialog"
        data-overlay="confirm"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Подтверждение"
        className="outline-none bg-white rounded-sheet p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        <div className="flex items-start gap-3 mb-6">
          <div className="flex-none bg-rose-50 rounded-full p-2">
            <AlertTriangle className="h-5 w-5 text-danger-text" />
          </div>
          <p className="text-gray-900 font-semibold leading-snug pt-1.5">{message}</p>
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
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-danger-text text-on-accent font-semibold py-3.5 rounded-tile shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
