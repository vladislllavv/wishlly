import { getAdminDb } from './admin.js';
import { requireEnv } from './env.js';
import { dueReminders, reminderText } from './holidays.js';
import { sendMessage } from './telegram.js';

const TIME_ZONE = 'Europe/Moscow';
const SEND_HOUR = 10;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const appId = process.env.VITE_APP_ID || 'wishforyou-tma-id';
const dataPath = `artifacts/${appId}/public/data`;

function nowInZone(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), hour: Number(parts.hour) };
}

// Возвращает true, если все уведомления обработаны окончательно (без временных сбоев Telegram/сети)
export async function runReminders(now = new Date(), dryRun = process.env.NOTIFY_DRY_RUN === '1'): Promise<boolean> {
  const db = getAdminDb();
  const today = nowInZone(now);
  const profiles = await db.collection(`${dataPath}/profiles`).get();
  let complete = true;

  for (const doc of profiles.docs) {
    const tgId = /^tg_(\d+)$/.exec(doc.id)?.[1];
    if (!tgId) continue;

    for (const reminder of dueReminders(doc.data(), today)) {
      const logId = `${doc.id}_${reminder.holiday.key}_${reminder.year}_${reminder.daysBefore}`;
      const text = reminderText(reminder);

      if (dryRun) {
        console.log(`[notify dry-run] ${logId} -> ${tgId}: ${text}`);
        continue;
      }

      // create() падает, если метка уже есть — так уведомление не уйдёт дважды даже из двух процессов
      const logRef = db.doc(`${dataPath}/notificationLog/${logId}`);
      try {
        await logRef.create({ sentAt: new Date(), status: 'sending' });
      } catch {
        continue;
      }

      const result = await sendMessage(Number(tgId), text, {
        inline_keyboard: [[{ text: '✨ Открыть вишлист', web_app: { url: requireEnv('WEBAPP_URL') } }]],
      });

      if (result.ok) {
        await logRef.update({ status: 'sent' });
      } else if (result.status === 429 || result.status === 0 || result.status >= 500) {
        // Временный сбой: снимаем метку, следующая проверка повторит отправку
        await logRef.delete();
        complete = false;
      } else {
        // 403 (бот заблокирован или /start не нажимали), 400 и т.п. — повторять бессмысленно
        await logRef.update({ status: 'failed', httpStatus: result.status });
      }
    }
  }
  return complete;
}

export function startReminderScheduler() {
  let lastDoneDate = '';

  const tick = async () => {
    try {
      const { y, m, d, hour } = nowInZone(new Date());
      const dateKey = `${y}-${m}-${d}`;
      if (hour < SEND_HOUR || lastDoneDate === dateKey) return;
      if (await runReminders()) lastDoneDate = dateKey;
    } catch (error) {
      console.error('Reminder job failed:', error);
    }
  };

  setInterval(tick, CHECK_INTERVAL_MS);
  void tick();
}
