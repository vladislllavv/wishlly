import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource-variable/manrope';
import './index.css';
import { initTheme } from './theme';
import { ErrorBoundary } from './ErrorBoundary';
import { reportClientError } from './errorReporting';

// ErrorBoundary ловит только ошибки рендера. Эти два обработчика — всё остальное
// (эффекты, обработчики событий, промисы), что иначе осело бы только в консоли
// вебвью, которую реальный пользователь никогда не увидит.
window.addEventListener('error', (e) => reportClientError('window-error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => reportClientError('unhandled-rejection', e.reason));

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
