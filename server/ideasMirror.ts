import { getAdminDb } from './admin.js';
import { getIdeasDataConnect } from './dataConnectAdmin.js';

const appId = process.env.VITE_APP_ID || 'wishforyou-tma-id';
const dataPath = `artifacts/${appId}/public/data`;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface IdeasDataConnectClient {
  listMirroredIdeaIds(): Promise<string[]>;
  upsertIdeaItem(id: string, data: {
    title: string; imageUrl: string; link: string;
    priceAmount: number | null; priceCurrency: string | null;
  }): Promise<void>;
  replaceIdeaInterests(ideaId: string, interests: string[]): Promise<void>;
  deleteIdeaItem(id: string): Promise<void>;
}

function hasRequiredFields(wish: Record<string, any>): boolean {
  return Boolean(wish.title && wish.imageUrl && wish.link);
}

// Reconciles the full set every run: upsert everything that currently qualifies,
// then delete any previously-mirrored id that no longer does. This one rule
// covers shareToIdeas turning false, required fields disappearing, AND the wish
// being deleted from Firestore outright (it just stops showing up in `docs`) —
// without three separate "did it change" code paths that can drift apart.
export async function runIdeasMirror(
  db: ReturnType<typeof getAdminDb> = getAdminDb(),
  dataConnect: IdeasDataConnectClient = wrapAdminDataConnect(getIdeasDataConnect()),
): Promise<void> {
  const wishes = await db.collection(`${dataPath}/wishes`).get();
  const keepIds = new Set<string>();
  for (const doc of wishes.docs) {
    const wish = doc.data() as Record<string, any>;
    if (wish.shareToIdeas !== true || !hasRequiredFields(wish)) continue;
    keepIds.add(doc.id);
    await dataConnect.upsertIdeaItem(doc.id, {
      title: wish.title,
      imageUrl: wish.imageUrl,
      link: wish.link,
      priceAmount: wish.priceAmount ?? null,
      priceCurrency: wish.priceCurrency ?? null,
    });
    await dataConnect.replaceIdeaInterests(doc.id, wish.interests ?? []);
  }

  const mirrored = await dataConnect.listMirroredIdeaIds();
  for (const id of mirrored) {
    if (!keepIds.has(id)) await dataConnect.deleteIdeaItem(id);
  }
}

// Adapts the real admin Data Connect SDK (table-level insert/upsert/delete helpers,
// see Task 4) to the narrow interface above, so production code and tests share
// the same `runIdeasMirror` logic while only the adapter touches the real SDK.
// `wishId` is IdeaItem's actual primary key column (Task 2) — the adapter is
// the one place that needs to know that; the rest of this file just says "id".
function wrapAdminDataConnect(dc: ReturnType<typeof getIdeasDataConnect>): IdeasDataConnectClient {
  return {
    async listMirroredIdeaIds() {
      const result = await dc.executeGraphql<{ ideaItems: { wishId: string }[] }, undefined>(
        'query { ideaItems { wishId } }',
      );
      return result.data.ideaItems.map((row) => row.wishId);
    },
    async upsertIdeaItem(id, data) {
      await dc.upsert('ideaItem', { wishId: id, ...data });
    },
    async replaceIdeaInterests(ideaId, interests) {
      await dc.executeGraphql('mutation($idea: String!) { ideaInterest_deleteMany(where: { ideaWishId: { eq: $idea } }) }', { variables: { idea: ideaId } });
      if (interests.length > 0) {
        await dc.insertMany('ideaInterest', interests.map((interest) => ({ ideaWishId: ideaId, interest })));
      }
    },
    async deleteIdeaItem(id) {
      await dc.executeGraphql('mutation($id: String!) { ideaItem_delete(key: { wishId: $id }) }', { variables: { id } });
    },
  };
}

export function startIdeasMirrorScheduler() {
  setInterval(() => {
    runIdeasMirror().catch((error) => console.error('Ideas mirror job failed:', error));
  }, CHECK_INTERVAL_MS);
  void runIdeasMirror().catch((error) => console.error('Ideas mirror job failed:', error));
}
