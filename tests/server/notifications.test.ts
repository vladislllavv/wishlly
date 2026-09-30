import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, friendBirthdayReminders, friendReminderText } from '../../server/holidays.js';
import { runReminders } from '../../server/notifications.js';

const today = (y: number, m: number, d: number) => ({ y, m, d });

test('dueReminders: день рождения за 14 и 7 дней, остальные дни молчат', () => {
  const profile = { birthdate: '1990-06-15', gender: 'Не указано' };
  assert.deepEqual(dueReminders(profile, today(2026, 6, 1)).map((r) => [r.holiday.key, r.daysBefore]), [['birthday', 14]]);
  assert.deepEqual(dueReminders(profile, today(2026, 6, 8)).map((r) => [r.holiday.key, r.daysBefore]), [['birthday', 7]]);
  assert.deepEqual(dueReminders(profile, today(2026, 6, 2)), []);
});

test('dueReminders: 8 Марта только для «Женский», 23 Февраля только для «Мужской»', () => {
  const p = (gender: string) => ({ gender });
  assert.deepEqual(dueReminders(p('Женский'), today(2027, 2, 22)).map((r) => r.holiday.key), ['mar8']);
  assert.deepEqual(dueReminders(p('Мужской'), today(2027, 2, 22)).map((r) => r.holiday.key), []);
  assert.deepEqual(dueReminders(p('Мужской'), today(2027, 2, 16)).map((r) => r.holiday.key), ['feb23']);
});

test('dueReminders: переход через Новый год', () => {
  const r = dueReminders({ birthdate: '1998-01-14' }, today(2026, 12, 31));
  assert.deepEqual(r.map((x) => [x.holiday.key, x.daysBefore, x.year]), [['birthday', 14, 2027]]);
});

test('friendBirthdayReminders: только день рождения владельца, без праздников и без даты', () => {
  assert.deepEqual(friendBirthdayReminders({ birthdate: '1990-06-15', gender: 'Женский' }, today(2026, 6, 1)), [{ daysBefore: 14, year: 2026 }]);
  assert.deepEqual(friendBirthdayReminders({ gender: 'Женский' }, today(2027, 2, 22)), []);
  assert.deepEqual(friendBirthdayReminders({ birthdate: '1990-06-15' }, today(2026, 6, 2)), []);
});

test('friendReminderText: с именем и без', () => {
  assert.match(friendReminderText('Макс', 7), /Через 7 дн\. у Макс день рождения/);
  assert.match(friendReminderText(undefined, 14), /у вашего друга/);
});

// ---- runReminders на подменённых Firestore и fetch ----

type Doc = Record<string, any>;
function fakeDb(profiles: Record<string, Doc>, friendships: Doc[]) {
  const logs = new Map<string, Doc>();
  const docsOf = (entries: [string, Doc][]) => ({ docs: entries.map(([id, data]) => ({ id, data: () => data })) });
  const db = {
    collection: (path: string) => ({
      get: async () => (path.endsWith('/profiles') ? docsOf(Object.entries(profiles)) : docsOf(friendships.map((f, i) => [`f${i}`, f] as [string, Doc]))),
    }),
    doc: (path: string) => ({
      create: async (data: Doc) => { if (logs.has(path)) throw new Error('ALREADY_EXISTS'); logs.set(path, data); },
      update: async (data: Doc) => { logs.set(path, { ...logs.get(path), ...data }); },
      delete: async () => { logs.delete(path); },
    }),
  };
  return { db: db as any, logs };
}

const realFetch = globalThis.fetch;
let sent: { chat_id: number; text: string; reply_markup: any }[] = [];
let telegramStatus = 200;
beforeEach(() => {
  sent = [];
  telegramStatus = 200;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.WEBAPP_URL = 'https://example.test/app';
  globalThis.fetch = (async (_url: any, init: any) => {
    sent.push(JSON.parse(init.body));
    return new Response('{}', { status: telegramStatus });
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

const NOW = new Date('2026-06-01T10:00:00+03:00'); // 14 дней до 15 июня

test('runReminders: свой ДР и ДР друга отправляются один раз, повторный запуск дублей не даёт', async () => {
  const { db } = fakeDb(
    { tg_1: { birthdate: '1990-06-15', gender: 'Не указано', firstName: 'Аня' }, tg_2: { birthdate: '1995-01-01', gender: 'Не указано' } },
    [{ ownerId: 'tg_1', friendId: 'tg_2', createdAt: 1 }],
  );
  assert.equal(await runReminders(NOW, false, db), true);
  assert.equal(sent.length, 2);
  const own = sent.find((m) => m.chat_id === 1)!;
  assert.match(own.text, /Через 14 дн\. — твой день рождения/);
  const friend = sent.find((m) => m.chat_id === 2)!;
  assert.match(friend.text, /у Аня день рождения/);
  assert.equal(friend.reply_markup.inline_keyboard[0][0].url, 'https://t.me/wishlly_bot/app?startapp=tg_1');

  await runReminders(NOW, false, db);
  assert.equal(sent.length, 2, 'повторный запуск не должен слать то же самое');
});

test('runReminders: не в срок и без Telegram-uid ничего не отправляет', async () => {
  const { db } = fakeDb(
    { tg_1: { birthdate: '1990-06-15' }, anon_9: { birthdate: '1990-06-15' } },
    [{ ownerId: 'tg_1', friendId: 'anon_9', createdAt: 1 }],
  );
  await runReminders(new Date('2026-06-02T10:00:00+03:00'), false, db);
  assert.equal(sent.length, 0);
  await runReminders(NOW, false, db);
  assert.equal(sent.length, 1, 'только владелец с tg_-uid, у anon_9 нет chat id');
});

test('runReminders: 403 фиксируется как failed без повтора, 500 снимает метку и просит повторить', async () => {
  const one = () => fakeDb({ tg_1: { birthdate: '1990-06-15' } }, []);
  telegramStatus = 403;
  const a = one();
  assert.equal(await runReminders(NOW, false, a.db), true);
  assert.equal([...a.logs.values()][0].status, 'failed');

  telegramStatus = 500;
  const b = one();
  assert.equal(await runReminders(NOW, false, b.db), false);
  assert.equal(b.logs.size, 0);
});

test('runReminders: dry-run ничего не отправляет и не пишет метки', async () => {
  const { db, logs } = fakeDb({ tg_1: { birthdate: '1990-06-15' } }, []);
  await runReminders(NOW, true, db);
  assert.equal(sent.length, 0);
  assert.equal(logs.size, 0);
});
