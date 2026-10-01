import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runIdeasMirror } from '../../server/ideasMirror.js';

type Doc = Record<string, any>;

function fakeFirestore(wishes: Record<string, Doc>) {
  return {
    collection: (path: string) => ({
      get: async () => ({
        docs: Object.entries(wishes).map(([id, data]) => ({ id, data: () => data })),
      }),
    }),
  } as any;
}

function fakeDataConnect(existingIds: string[] = []) {
  const ideaItems = new Map<string, Doc>(); // keyed by wishId
  for (const id of existingIds) ideaItems.set(id, { title: 'старое' });
  const ideaInterests: { idea: string; interest: string }[] = [];
  const deleted: string[] = [];
  return {
    client: {
      async listMirroredIdeaIds() { return [...ideaItems.keys()]; },
      async upsertIdeaItem(id: string, data: Doc) { ideaItems.set(id, { ...ideaItems.get(id), ...data }); },
      async replaceIdeaInterests(ideaId: string, interests: string[]) {
        for (let i = ideaInterests.length - 1; i >= 0; i--) if (ideaInterests[i].idea === ideaId) ideaInterests.splice(i, 1);
        for (const interest of interests) ideaInterests.push({ idea: ideaId, interest });
      },
      async deleteIdeaItem(id: string) { ideaItems.delete(id); deleted.push(id); },
    },
    ideaItems, ideaInterests, deleted,
  };
}

const validWish = {
  shareToIdeas: true,
  title: 'Йога-коврик',
  imageUrl: 'https://example.test/mat.png',
  link: 'https://example.test/mat',
  priceAmount: 1990,
  priceCurrency: '₽',
  interests: ['Йога', 'Фитнес'],
};

test('shareToIdeas=true с полными полями создаёт/обновляет IdeaItem и его интересы', async () => {
  const db = fakeFirestore({ w1: validWish });
  const dc = fakeDataConnect();
  await runIdeasMirror(db, dc.client);
  assert.deepEqual(dc.ideaItems.get('w1'), {
    title: 'Йога-коврик', imageUrl: 'https://example.test/mat.png', link: 'https://example.test/mat',
    priceAmount: 1990, priceCurrency: '₽',
  });
  assert.deepEqual(dc.ideaInterests, [{ idea: 'w1', interest: 'Йога' }, { idea: 'w1', interest: 'Фитнес' }]);
});

test('shareToIdeas=true но без imageUrl/link — не мёрджится, пропускается без ошибки', async () => {
  const db = fakeFirestore({ w1: { ...validWish, imageUrl: '', link: '' } });
  const dc = fakeDataConnect();
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.size, 0);
});

test('shareToIdeas=false удаляет ранее смирроренный IdeaItem', async () => {
  const db = fakeFirestore({ w1: { ...validWish, shareToIdeas: false } });
  const dc = fakeDataConnect(['w1']);
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.has('w1'), false);
  assert.deepEqual(dc.deleted, ['w1']);
});

test('вишлист удалён из Firestore целиком — ранее смирроренная идея тоже удаляется', async () => {
  const db = fakeFirestore({}); // w1 больше не существует вовсе
  const dc = fakeDataConnect(['w1']);
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.has('w1'), false);
  assert.deepEqual(dc.deleted, ['w1']);
});

test('нет поля shareToIdeas вовсе — не создаём и не падаем', async () => {
  const db = fakeFirestore({ w1: { title: 'x' } });
  const dc = fakeDataConnect();
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.size, 0);
  assert.deepEqual(dc.deleted, []);
});
