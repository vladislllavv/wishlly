import type { Request, Response } from 'express';
import { requireEnv } from '../env.js';

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const res = await fetch(
    `https://api.telegram.org/bot${requireEnv('TELEGRAM_BOT_TOKEN')}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    }
  );
  if (!res.ok) console.error('sendMessage failed:', await res.text());
}

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
