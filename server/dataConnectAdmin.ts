import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';

const CONNECTOR_CONFIG = {
  location: 'europe-north1',
  serviceId: 'wishlly-932c0-service',
  connector: 'ideas',
};

let instance: DataConnect | null = null;

export function getIdeasDataConnect(): DataConnect {
  if (!instance) instance = getDataConnect(CONNECTOR_CONFIG);
  return instance;
}

// FeedProduct/FeedProductInterest (dataconnect/schema/feed.gql) живут в том же
// сервисе/БД, что и ideas-схема, но у них нет своего коннектора (клиент их не
// читает напрямую) — `connector` в ConnectorConfig опционален и нужен только для
// операций конкретного сгенерированного коннектора, которых здесь нет.
let feedInstance: DataConnect | null = null;

export function getFeedDataConnect(): DataConnect {
  if (!feedInstance) feedInstance = getDataConnect({ location: CONNECTOR_CONFIG.location, serviceId: CONNECTOR_CONFIG.serviceId });
  return feedInstance;
}
