import { requireEnv } from './env.js';

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: unknown,
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${requireEnv('TELEGRAM_BOT_TOKEN')}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
      },
    );
    if (!res.ok) console.error('sendMessage failed:', res.status, await res.text());
    return { ok: res.ok, status: res.status };
  } catch (error) {
    console.error('sendMessage network error:', error);
    return { ok: false, status: 0 };
  }
}
