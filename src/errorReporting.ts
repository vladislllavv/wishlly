// Лёгкий репортер необработанных ошибок — чтобы при белом экране у реального
// пользователя в логах сервера был текст ошибки и стек, а не только догадки.
export function reportClientError(context: string, error: unknown): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.slice(0, 2000) : undefined;
    const body = JSON.stringify({
      context,
      message,
      stack,
      url: location.href,
      userAgent: navigator.userAgent,
      inTelegram: !!window.Telegram?.WebApp?.initData,
    });
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Репортер не должен сам становиться источником падения
  }
}
