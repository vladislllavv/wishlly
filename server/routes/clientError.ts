import type { Request, Response } from 'express';

const MAX_LEN = { context: 64, message: 500, stack: 2000, url: 300, userAgent: 300 };

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

// Белый экран у реального пользователя иначе ничего не оставляет в логах — этот
// эндпоинт просто пишет в журнал процесса то, что иначе осело бы в недоступной
// пользователю консоли вебвью. Хранилище не нужно: достаточно journalctl.
export function handleClientError(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const context = str(body.context, MAX_LEN.context) || 'unknown';
  const message = str(body.message, MAX_LEN.message);
  const stack = str(body.stack, MAX_LEN.stack);
  const url = str(body.url, MAX_LEN.url);
  const userAgent = str(body.userAgent, MAX_LEN.userAgent);
  const inTelegram = body.inTelegram === true;

  console.error(
    `[client-error] context=${context} inTelegram=${inTelegram} url=${url} ua="${userAgent}" message="${message}"${stack ? `\n${stack}` : ''}`
  );
  res.status(204).send();
}
