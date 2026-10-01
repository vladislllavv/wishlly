import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runGrowthReport } from '../../server/growthReport.js';

type Doc = Record<string, any>;
function fakeDb(profiles: Record<string, Doc>) {
  const docsOf = (entries: [string, Doc][]) => ({
    docs: entries.map(([id, data]) => ({ id, data: () => data })),
    size: entries.length,
  });
  const db = {
    collection: (_path: string) => ({
      where: () => ({
        get: async () => docsOf(Object.entries(profiles).filter(([, p]) => p.onboardingCompleted)),
      }),
    }),
  };
  return db as any;
}

const realFetch = globalThis.fetch;
let sent: { chat_id: number; text: string }[] = [];
let telegramStatus = 200;
beforeEach(() => {
  sent = [];
  telegramStatus = 200;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  globalThis.fetch = (async (_url: any, init: any) => {
    sent.push(JSON.parse(init.body));
    return new Response('{}', { status: telegramStatus });
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

const NOW = new Date('2026-10-01T09:00:00+03:00').getTime();
const DAY = 24 * 60 * 60 * 1000;

test('runGrowthReport: считает только новых за сутки и шлёт обоим получателям', async () => {
  const db = fakeDb({
    tg_1: { onboardingCompleted: true, createdAt: NOW - 2 * DAY, firstName: 'Старый' },
    tg_2: { onboardingCompleted: true, createdAt: NOW - 1000, firstName: 'Новый' },
    tg_3: { onboardingCompleted: false, createdAt: NOW - 1000 },
  });
  await runGrowthReport(new Date(NOW), false, db);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((m) => m.chat_id).sort(), [56733076, 855740044]);
  assert.match(sent[0].text, /Новых: 1 \(Новый\)/);
  assert.match(sent[0].text, /Всего в базе: 2/);
});

test('runGrowthReport: без новых за сутки всё равно шлёт сводку с нулём', async () => {
  const db = fakeDb({ tg_1: { onboardingCompleted: true, createdAt: NOW - 2 * DAY } });
  await runGrowthReport(new Date(NOW), false, db);
  assert.match(sent[0].text, /Новых: 0/);
  assert.doesNotMatch(sent[0].text, /\(/);
});

test('runGrowthReport: dry-run ничего не отправляет', async () => {
  const db = fakeDb({ tg_1: { onboardingCompleted: true, createdAt: NOW } });
  await runGrowthReport(new Date(NOW), true, db);
  assert.equal(sent.length, 0);
});
