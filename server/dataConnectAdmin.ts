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
