import { getAdminDb } from './admin.js';
import { sendMessage } from './telegram.js';

const TIME_ZONE = 'Europe/Moscow';
const SEND_HOUR = 9;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Получатели ежедневного отчёта о новых пользователях: Валентин и Влад
const REPORT_CHAT_IDS = [855740044, 56733076];

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

export async function runGrowthReport(
  now = new Date(),
  dryRun = process.env.NOTIFY_DRY_RUN === '1',
  db: ReturnType<typeof getAdminDb> = getAdminDb(),
): Promise<void> {
  const since = now.getTime() - REPORT_WINDOW_MS;
  const profiles = await db
    .collection(`${dataPath}/profiles`)
    .where('onboardingCompleted', '==', true)
    .get();

  const newProfiles = profiles.docs.filter((d: any) => (d.data().createdAt ?? 0) >= since);
  const names = newProfiles.map((d: any) => d.data().firstName).filter((name: unknown): name is string => !!name);

  const text = [
    '📊 Wishlly: новые пользователи за сутки',
    `Новых: ${newProfiles.length}${names.length ? ` (${names.join(', ')})` : ''}`,
    `Всего в базе: ${profiles.size}`,
  ].join('\n');

  if (dryRun) {
    console.log(`[growth-report dry-run] ${text}`);
    return;
  }

  for (const chatId of REPORT_CHAT_IDS) {
    await sendMessage(chatId, text);
  }
}

export function startGrowthReportScheduler() {
  let lastDoneDate = '';

  const tick = async () => {
    try {
      const { y, m, d, hour } = nowInZone(new Date());
      const dateKey = `${y}-${m}-${d}`;
      if (hour < SEND_HOUR || lastDoneDate === dateKey) return;
      await runGrowthReport();
      lastDoneDate = dateKey;
    } catch (error) {
      console.error('Growth report job failed:', error);
    }
  };

  setInterval(tick, CHECK_INTERVAL_MS);
  void tick();
}
