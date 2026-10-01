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

function fakeAuth(users: { uid: string; creationTime: string }[]) {
  return {
    listUsers: async () => ({
      users: users.map((u) => ({ uid: u.uid, metadata: { creationTime: u.creationTime } })),
      pageToken: undefined,
    }),
  } as any;
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

const NOW = new Date('2026-10-01T09:00:00+03:00');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

test('runGrowthReport: делит новых за сутки на завершивших регистрацию и нет', async () => {
  const db = fakeDb({
    tg_2: { onboardingCompleted: true, firstName: 'Новый' },
    tg_4: { onboardingCompleted: true, firstName: 'Старый' }, // открыл аккаунт давно, в отчёт не попадёт
  });
  const auth = fakeAuth([
    { uid: 'tg_1', creationTime: iso(NOW.getTime() - 2 * DAY) }, // вне окна 24ч
    { uid: 'tg_2', creationTime: iso(NOW.getTime() - 1000) }, // открыл и зарегистрировался
    { uid: 'tg_3', creationTime: iso(NOW.getTime() - 500) }, // открыл, но не зарегистрировался
  ]);
  await runGrowthReport(NOW, false, db, auth);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((m) => m.chat_id).sort(), [56733076, 855740044]);
  assert.match(sent[0].text, /Открыли мини-апп: 2/);
  assert.match(sent[0].text, /Завершили регистрацию: 1 \(Новый\)/);
  assert.match(sent[0].text, /Не завершили регистрацию: 1/);
  assert.match(sent[0].text, /Всего зарегистрировано: 2/);
});

test('runGrowthReport: без новых открытий всё равно шлёт нулевую сводку', async () => {
  const db = fakeDb({ tg_1: { onboardingCompleted: true } });
  const auth = fakeAuth([{ uid: 'tg_1', creationTime: iso(NOW.getTime() - 2 * DAY) }]);
  await runGrowthReport(NOW, false, db, auth);
  assert.match(sent[0].text, /Открыли мини-апп: 0/);
  assert.match(sent[0].text, /Завершили регистрацию: 0/);
  assert.doesNotMatch(sent[0].text, /\(/);
});

test('runGrowthReport: dry-run ничего не отправляет', async () => {
  const db = fakeDb({});
  const auth = fakeAuth([{ uid: 'tg_1', creationTime: iso(NOW.getTime()) }]);
  await runGrowthReport(NOW, true, db, auth);
  assert.equal(sent.length, 0);
});
