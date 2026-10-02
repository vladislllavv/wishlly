import type { DataConnect } from 'firebase-admin/data-connect';
import { getFeedDataConnect } from './dataConnectAdmin.js';
import type { TakprodamOffer } from './takprodam.js';

interface FeedProductRow {
  externalId: string;
  title: string;
  imageUrl: string;
  link: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  category: string;
}

function rowToOffer(row: FeedProductRow): TakprodamOffer {
  return {
    id: row.externalId,
    title: row.title,
    url: row.link,
    imageUrl: row.imageUrl,
    price: row.priceAmount,
    currency: row.priceCurrency,
    category: row.category,
  };
}

export async function getFeedProductsByInterests(
  interests: string[],
  dataConnect: DataConnect = getFeedDataConnect(),
): Promise<TakprodamOffer[]> {
  if (interests.length === 0) return [];
  const result = await dataConnect.executeGraphql<
    { feedProductInterests: { product: FeedProductRow }[] },
    { interests: string[] }
  >(
    'query($interests: [String!]) { feedProductInterests(where: { interest: { in: $interests } }) { product { externalId title imageUrl link priceAmount priceCurrency category } } }',
    { variables: { interests } },
  );
  const byId = new Map<string, TakprodamOffer>();
  for (const row of result.data.feedProductInterests) {
    const offer = rowToOffer(row.product);
    byId.set(offer.id, offer);
  }
  return [...byId.values()];
}
