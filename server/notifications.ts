import { getAdminDb } from './admin.js';
import { requireEnv } from './env.js';
import { dueReminders, reminderText, friendBirthdayReminders, friendReminderText } from './holidays.js';
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
export async function runReminders(
  now = new Date(),
  dryRun = process.env.NOTIFY_DRY_RUN === '1',
  db: ReturnType<typeof getAdminDb> = getAdminDb(),
): Promise<boolean> {
  const today = nowInZone(now);
  const profiles = await db.collection(`${dataPath}/profiles`).get();
  const profileById = new Map(profiles.docs.map((d) => [d.id, d.data()]));
  let complete = true;

  // Отправка с защитой от дублей: метка создаётся до отправки (create() падает, если она уже есть)
  async function deliver(logId: string, tgId: string, text: string, button: Record<string, unknown>) {
    if (dryRun) {
      console.log(`[notify dry-run] ${logId} -> ${tgId}: ${text}`);
      return;
    }
    const logRef = db.doc(`${dataPath}/notificationLog/${logId}`);
    try {
      await logRef.create({ sentAt: new Date(), status: 'sending' });
    } catch {
      return;
    }

    const result = await sendMessage(Number(tgId), text, { inline_keyboard: [[button]] });

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

  // 1) Собственные праздники пользователя
  for (const [uid, profile] of profileById) {
    const tgId = /^tg_(\d+)$/.exec(uid)?.[1];
    if (!tgId) continue;
    for (const reminder of dueReminders(profile, today)) {
      await deliver(
        `${uid}_${reminder.holiday.key}_${reminder.year}_${reminder.daysBefore}`,
        tgId,
        reminderText(reminder),
        { text: '✨ Открыть вишлист', web_app: { url: requireEnv('WEBAPP_URL') } },
      );
    }
  }

  // 2) Дни рождения друзей: тем, кто присоединился к вишлисту (коллекция friendships)
  const botUsername = process.env.VITE_BOT_USERNAME || 'wishlly_bot';
  const friendships = await db.collection(`${dataPath}/friendships`).get();
  for (const doc of friendships.docs) {
    const { ownerId, friendId } = doc.data() as { ownerId?: string; friendId?: string };
    const friendTgId = friendId && /^tg_(\d+)$/.exec(friendId)?.[1];
    const owner = ownerId ? profileById.get(ownerId) : undefined;
    if (!ownerId || !friendId || !friendTgId || !owner) continue;
    for (const { daysBefore, year } of friendBirthdayReminders(owner, today)) {
      await deliver(
        `${friendId}_friend_${ownerId}_${year}_${daysBefore}`,
        friendTgId,
        friendReminderText(owner.firstName, daysBefore),
        { text: '🎁 Открыть вишлист', url: `https://t.me/${botUsername}/app?startapp=${ownerId}` },
      );
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
