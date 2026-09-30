import type { Request, Response } from 'express';
import { requireEnv } from '../env.js';
import { sendMessage } from '../telegram.js';

export async function handleTelegramWebhook(req: Request, res: Response) {
  // Telegram присылает секрет, указанный при setWebhook — отсекаем чужие запросы
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== requireEnv('TELEGRAM_WEBHOOK_SECRET')) {
    res.status(403).send('Forbidden');
    return;
  }

  const update = req.body;
  const message = update?.message;

  if (message?.text?.startsWith('/start')) {
    await sendMessage(
      message.chat.id,
      'Привет! 🎁 WISHLLY — твой вишлист, которым легко делиться с друзьями.',
      {
        inline_keyboard: [
          [{ text: '✨ Открыть вишлист', web_app: { url: requireEnv('WEBAPP_URL') } }],
        ],
      }
    );
  }

  // Всегда 200, иначе Telegram будет повторять доставку
  res.send('ok');
}
