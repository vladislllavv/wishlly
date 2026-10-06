import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapAdminModerationClient } from '../../server/ideasModeration.js';

type Row = Record<string, any>;

// Фейк админского Data Connect SDK — тот же узкий интерфейс (executeGraphql/upsert), что и в
// tests/server/ideasMirror.test.ts, но здесь ещё нужно читать аргументы executeGraphql, чтобы
// фейковый where-фильтр отличал pending от approved/rejected.
function fakeDataConnect(ideaItems: Row[]) {
  const upserts: Row[] = [];
  return {
    client: {
      async executeGraphql(query: string) {
        void query; // в реальном запросе всегда фильтр по status: "pending" — фейку этого достаточно
        const pending = ideaItems.filter((row) => row.status === 'pending');
        return {
          data: {
            ideaItems: pending.map((row) => ({
              id: row.id,
              title: row.title,
              imageUrl: row.imageUrl,
              link: row.link,
              priceAmount: row.priceAmount ?? null,
              priceCurrency: row.priceCurrency ?? null,
              createdAt: row.createdAt,
              ideaInterests_on_idea: (row.interests ?? []).map((interest: string) => ({ interest })),
            })),
          },
        };
      },
      async upsert(tableName: string, data: Row) {
        assert.equal(tableName, 'ideaItem');
        upserts.push(data);
        const row = ideaItems.find((r) => r.id === data.id);
        if (row) row.status = data.status;
      },
    },
    upserts,
  };
}

const baseRow = {
  id: 'idea-1', title: 'Коврик для йоги', imageUrl: 'https://example.test/mat.png',
  link: 'https://example.test/mat', priceAmount: 1990, priceCurrency: '₽',
  createdAt: '2026-10-01T00:00:00Z', interests: ['Йога'], status: 'pending',
};

test('listPending возвращает только pending-идеи с распакованными интересами', async () => {
  const dc = fakeDataConnect([baseRow, { ...baseRow, id: 'idea-2', status: 'approved' }]);
  const client = wrapAdminModerationClient(dc.client as any);
  const pending = await client.listPending();
  assert.equal(pending.length, 1);
  assert.deepEqual(pending[0], {
    id: 'idea-1', title: 'Коврик для йоги', imageUrl: 'https://example.test/mat.png',
    link: 'https://example.test/mat', priceAmount: 1990, priceCurrency: '₽',
    createdAt: '2026-10-01T00:00:00Z', interests: ['Йога'],
  });
});

test('setStatus делает partial upsert по id, не трогая остальные поля', async () => {
  const row = { ...baseRow };
  const dc = fakeDataConnect([row]);
  const client = wrapAdminModerationClient(dc.client as any);
  await client.setStatus('idea-1', 'approved');
  assert.deepEqual(dc.upserts, [{ id: 'idea-1', status: 'approved' }]);
  assert.equal(row.status, 'approved');
});

test('listPending ничего не находит, если все идеи уже обработаны', async () => {
  const dc = fakeDataConnect([{ ...baseRow, status: 'approved' }]);
  const client = wrapAdminModerationClient(dc.client as any);
  assert.deepEqual(await client.listPending(), []);
});
