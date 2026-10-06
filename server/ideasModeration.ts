import { getAdminDb } from './admin.js';
import { getIdeasDataConnect } from './dataConnectAdmin.js';

export interface PendingIdea {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  createdAt: string;
  interests: string[];
}

// Узкий интерфейс (как в server/ideasMirror.ts) — тесты подставляют фейковый клиент,
// а не настоящий админский Data Connect SDK.
export interface IdeasModerationClient {
  listPending(): Promise<PendingIdea[]>;
  setStatus(id: string, status: 'approved' | 'rejected'): Promise<void>;
}

interface IdeaItemRow {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  createdAt: string;
  ideaInterests_on_idea: { interest: string }[];
}

export function wrapAdminModerationClient(dc: ReturnType<typeof getIdeasDataConnect>): IdeasModerationClient {
  return {
    async listPending() {
      const result = await dc.executeGraphql<{ ideaItems: IdeaItemRow[] }, undefined>(
        `query {
          ideaItems(where: { status: { eq: "pending" } }, orderBy: { createdAt: ASC }) {
            id title imageUrl link priceAmount priceCurrency createdAt
            ideaInterests_on_idea { interest }
          }
        }`,
      );
      return result.data.ideaItems.map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.imageUrl,
        link: row.link,
        priceAmount: row.priceAmount,
        priceCurrency: row.priceCurrency,
        createdAt: row.createdAt,
        interests: row.ideaInterests_on_idea.map((i) => i.interest),
      }));
    },
    // Partial upsert по первичному ключу id: обновляет только status, остальные колонки не трогает.
    async setStatus(id, status) {
      await dc.upsert('ideaItem', { id, status });
    },
  };
}

// getAdminDb() first: гарантирует, что admin-приложение инициализировано (см. server/admin.ts)
// до getIdeasDataConnect(), который без явного app падает на тот же дефолтный getApp().
export function getDefaultModerationClient(): IdeasModerationClient {
  getAdminDb();
  return wrapAdminModerationClient(getIdeasDataConnect());
}
