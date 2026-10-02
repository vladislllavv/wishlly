import { Component, type ErrorInfo, type ReactNode } from 'react';
import { XCircle } from 'lucide-react';
import { reportClientError } from './errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Без этого перехватчика необработанная ошибка рендера молча оставляла бы
// пользователя на белом экране (React размонтирует дерево без единого следа).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError('render', error);
    console.error('Render crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-app px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Что-то пошло не так</h2>
          <p className="text-gray-500 font-medium">Попробуйте перезапустить приложение.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-gradient-to-r from-accent to-accent-2 text-on-accent font-bold rounded-button px-8 py-3.5 shadow-lg shadow-pink-200/50 active:scale-[0.98] transition-all"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }
}
