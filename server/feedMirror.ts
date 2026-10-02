import { getTakprodamOffers, type TakprodamOffer } from './takprodam.js';
import { getFeedDataConnect } from './dataConnectAdmin.js';
import { tagInterests } from './feedInterestTags.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // совпадает с CACHE_TTL_MS в takprodam.ts — чаще не имеет смысла

export interface FeedDataConnectClient {
  listFeedProductIds(): Promise<string[]>;
  upsertFeedProduct(id: string, data: {
    title: string; imageUrl: string; link: string;
    priceAmount: number | null; priceCurrency: string | null; category: string;
  }): Promise<void>;
  replaceFeedProductInterests(productId: string, interests: string[]): Promise<void>;
  deleteFeedProduct(id: string): Promise<void>;
}

// Тот же паттерн reconcile, что в server/ideasMirror.ts: апсертим всё актуальное,
// затем удаляем из хранилища то, чего больше нет в текущем кэше Такпродам.
export async function runFeedMirror(
  getOffers: () => TakprodamOffer[] = getTakprodamOffers,
  dataConnect: FeedDataConnectClient = wrapAdminDataConnect(getFeedDataConnect()),
): Promise<void> {
  const offers = getOffers();
  // getTakprodamOffers() — это кэш, а не источник истины: он пуст при холодном старте, пока
  // первый фоновый рефреш ещё не завершился (а с троттлингом запросов это может занять минуты),
  // и при не настроенных TAKPRODAM_API_TOKEN/TAKPRODAM_SOURCE_ID остаётся пустым навсегда. Без
  // этой проверки reconcile-проход ниже удалил бы из Postgres вообще все FeedProduct на каждом
  // такого рода прогоне — в отличие от ideasMirror.ts, где Firestore всегда полный и авторитетный.
  if (offers.length === 0) return;
  const keepIds = new Set<string>();
  for (const offer of offers) {
    if (!offer.imageUrl) continue; // FeedProduct.imageUrl не nullable
    keepIds.add(offer.id);
    try {
      await dataConnect.upsertFeedProduct(offer.id, {
        title: offer.title,
        imageUrl: offer.imageUrl,
        link: offer.url,
        priceAmount: offer.price,
        priceCurrency: offer.currency,
        category: offer.category,
      });
      await dataConnect.replaceFeedProductInterests(offer.id, tagInterests(offer.category, offer.title));
    } catch (error) {
      console.error(`Feed mirror failed for offer ${offer.id}:`, error);
    }
  }

  const mirrored = await dataConnect.listFeedProductIds();
  for (const id of mirrored) {
    if (keepIds.has(id)) continue;
    try {
      await dataConnect.deleteFeedProduct(id);
    } catch (error) {
      console.error(`Feed mirror delete failed for ${id}:`, error);
    }
  }
}

// Адаптирует настоящий Admin Data Connect SDK (generic upsert/insertMany/executeGraphql)
// к узкому интерфейсу выше — тот же приём, что wrapAdminDataConnect в ideasMirror.ts.
//
// productExternalId ниже — имя сгенерированного FK-поля по аналогии с уже подтверждённым
// на эмуляторе ideaWishId для IdeaInterest (см. server/ideasMirror.ts, коммит 044ca8c).
// Перед первым деплоем этой схемы стоит проверить интроспекцией
// ({ __type(name: "FeedProductInterest_Where") { inputFields { name } } }), что
// реальное имя поля совпадает, и поправить обе GraphQL-строки ниже при расхождении.
function wrapAdminDataConnect(dc: ReturnType<typeof getFeedDataConnect>): FeedDataConnectClient {
  return {
    async listFeedProductIds() {
      const result = await dc.executeGraphql<{ feedProducts: { externalId: string }[] }, undefined>(
        'query { feedProducts { externalId } }',
      );
      return result.data.feedProducts.map((row) => row.externalId);
    },
    async upsertFeedProduct(id, data) {
      await dc.upsert('feedProduct', { externalId: id, ...data });
    },
    async replaceFeedProductInterests(productId, interests) {
      await dc.executeGraphql(
        'mutation($id: String!) { feedProductInterest_deleteMany(where: { productExternalId: { eq: $id } }) }',
        { variables: { id: productId } },
      );
      if (interests.length > 0) {
        await dc.insertMany('feedProductInterest', interests.map((interest) => ({ productExternalId: productId, interest })));
      }
    },
    async deleteFeedProduct(id) {
      await dc.executeGraphql(
        'mutation($id: String!) { feedProduct_delete(key: { externalId: $id }) }',
        { variables: { id } },
      );
    },
  };
}

export function startFeedMirrorScheduler() {
  setInterval(() => {
    runFeedMirror().catch((error) => console.error('Feed mirror job failed:', error));
  }, CHECK_INTERVAL_MS);
  void runFeedMirror().catch((error) => console.error('Feed mirror job failed:', error));
}
