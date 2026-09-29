// Локальная заглушка Firebase для просмотра интерфейса без .env и без обращения к боевой базе.
// Подключается только конфигом vite.mock.config.ts (npm run dev:mock) — в прод-сборку не попадает.
// Данные живут в памяти вкладки и сбрасываются при перезагрузке.

type Data = Record<string, any>;
type Ref = { kind: 'doc' | 'coll' | 'query'; path: string; id?: string; constraints?: any[] };

const store = new Map<string, Map<string, Data>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
const table = (path: string) => { if (!store.has(path)) store.set(path, new Map()); return store.get(path)!; };
const seg = (parts: any[]) => parts.filter(p => typeof p === 'string').join('/');

const APP_ID = import.meta.env.VITE_APP_ID || 'wishforyou-tma-id';
const BASE = `artifacts/${APP_ID}/public/data`;
const ME = 'mock_me';
const FRIEND = 'mock_friend';
const now = Date.now();

// ---- Демо-данные ----
const seed = (coll: string, id: string, data: Data) => table(`${BASE}/${coll}`).set(id, data);
seed('profiles', ME, { birthdate: '1998-11-14', gender: 'Женский', firstName: 'Алина', interests: ['Фотография', 'Йога', 'Парфюмерия'], onboardingCompleted: true, createdAt: now });
seed('profiles', FRIEND, { birthdate: '1995-10-05', gender: 'Мужской', firstName: 'Макс', onboardingCompleted: true, createdAt: now });
seed('groups', 'g1', { name: 'День рождения', ownerId: ME, createdAt: now - 5000 });
seed('groups', 'g2', { name: 'Новый год', ownerId: ME, createdAt: now - 4000 });
const wish = (id: string, w: Data) => seed('wishes', id, { link: '', imageUrl: '', note: '', ownerName: 'Алина', ownerId: ME, groupId: 'unassigned', createdAt: now, ...w });
wish('w1', { title: 'Беспроводные наушники Sony WH-1000XM5', price: '29 990 ₽', priceAmount: 29990, priceCurrency: '₽', link: 'https://example.com/sony', groupId: 'g1', createdAt: now - 1000 });
wish('w2', { title: 'Книга «Атомные привычки»', price: '850 ₽', priceAmount: 850, priceCurrency: '₽', groupId: 'g2', createdAt: now - 2000 });
wish('w3', { title: 'Очень-очень-длинное-название-без-пробелов-чтобы-проверить-перенос-текста-в-карточке', price: '5 000 ₽', priceAmount: 5000, priceCurrency: '₽', createdAt: now - 3000 });
wish('w4', { title: 'Плед из мериносовой шерсти', price: '4 500 ₽', priceAmount: 4500, priceCurrency: '₽', groupId: 'g2', createdAt: now - 4000 });
wish('f1', { title: 'Кроссовки Nike Air Max', price: '12 000 ₽', priceAmount: 12000, priceCurrency: '₽', ownerId: FRIEND, ownerName: 'Макс', link: 'https://example.com/nike', createdAt: now - 1000 });
wish('f2', { title: 'Набор для настольных игр', price: '3 200 ₽', priceAmount: 3200, priceCurrency: '₽', ownerId: FRIEND, ownerName: 'Макс', createdAt: now - 2000 });
wish('f3', { title: 'Рюкзак для ноутбука', price: '5 900 ₽', priceAmount: 5900, priceCurrency: '₽', ownerId: FRIEND, ownerName: 'Макс', createdAt: now - 3000 });

// Брони — отдельная «коллекция», как в реальной схеме (owner желания её читать не может, см. firestore.rules)
seed('reservations', 'f2', { wishId: 'f2', ownerId: FRIEND, reservedBy: 'mock_someone_else', updatedAt: now });
seed('reservations', 'f3', { wishId: 'f3', ownerId: FRIEND, reservedBy: ME, updatedAt: now });

// ---- app / auth ----
export const initializeApp = (_config?: unknown) => ({});
const authObj: any = { currentUser: null, authStateReady: async () => {} };
const fakeUser = { uid: ME, isAnonymous: true };
const authCbs = new Set<(u: any) => void>();
export const initializeAuth = () => authObj;
export const getAuth = () => authObj;
export const indexedDBLocalPersistence = {};
export const browserLocalPersistence = {};
export type User = typeof fakeUser;
export const signInAnonymously = async () => { authObj.currentUser = fakeUser; setTimeout(() => authCbs.forEach(cb => cb(fakeUser)), 150); };
export const signInWithCustomToken = signInAnonymously;
export const onAuthStateChanged = (_auth: unknown, cb: (u: any) => void) => { authCbs.add(cb); return () => authCbs.delete(cb); };

// ---- firestore ----
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

const isRef = (x: any): x is Ref => x && typeof x === 'object' && 'kind' in x;
export const collection = (base: any, ...parts: string[]): Ref => ({ kind: 'coll', path: isRef(base) ? [base.path, ...parts].join('/') : seg(parts) });
export const doc = (base: any, ...parts: string[]): Ref => {
  const path = isRef(base) ? [base.path, ...parts].join('/') : seg(parts);
  return { kind: 'doc', path, id: path.split('/').pop() };
};
export const where = (field: string, op: string, value: any) => ({ field, op, value });
export const query = (ref: Ref, ...constraints: any[]): Ref => ({ kind: 'query', path: ref.path, constraints });

const matches = (data: Data, cs: any[] = []) => cs.every(c => c.op === '==' && data[c.field] === c.value);
const parent = (path: string) => path.split('/').slice(0, -1).join('/');

export const onSnapshot = (ref: Ref, next: (s: any) => void, _err?: (e: unknown) => void) => {
  const emit = () => {
    if (ref.kind === 'doc') {
      const data = table(parent(ref.path)).get(ref.id!);
      next({ exists: () => !!data, data: () => data, id: ref.id, metadata: { fromCache: false } });
    } else {
      const docs = [...table(ref.path).entries()]
        .filter(([, d]) => matches(d, ref.constraints))
        .map(([id, d]) => ({ id, data: () => ({ ...d }) }));
      next({ docs, metadata: { fromCache: false } });
    }
  };
  const run = () => setTimeout(emit, 0);
  listeners.add(run);
  setTimeout(emit, 350); // имитируем сеть, чтобы были видны скелетоны
  return () => listeners.delete(run);
};

export const getDoc = async (ref: Ref) => {
  const data = table(parent(ref.path)).get(ref.id!);
  return { exists: () => !!data, data: () => data, id: ref.id };
};

// Разовое чтение коллекции/запроса (нужно вкладке «Идеи»)
export const getDocs = async (ref: Ref) => {
  const docs = [...table(ref.path).entries()]
    .filter(([, d]) => matches(d, ref.constraints))
    .map(([id, d]) => ({ id, data: () => ({ ...d }) }));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb: (d: any) => void) => docs.forEach(cb), metadata: { fromCache: false } };
};

let counter = 0;
export const addDoc = async (ref: Ref, data: Data) => { const id = `new${++counter}`; table(ref.path).set(id, { ...data }); notify(); return { id }; };
export const setDoc = async (ref: Ref, data: Data, opts?: { merge?: boolean }) => {
  const t = table(parent(ref.path));
  t.set(ref.id!, opts?.merge ? { ...(t.get(ref.id!) || {}), ...data } : { ...data });
  notify();
};
export const updateDoc = async (ref: Ref, data: Data) => { const t = table(parent(ref.path)); t.set(ref.id!, { ...(t.get(ref.id!) || {}), ...data }); notify(); };
export const deleteDoc = async (ref: Ref) => { table(parent(ref.path)).delete(ref.id!); notify(); };
export const writeBatch = () => {
  const ops: Array<() => void> = [];
  return {
    update: (ref: Ref, data: Data) => { ops.push(() => { const t = table(parent(ref.path)); t.set(ref.id!, { ...(t.get(ref.id!) || {}), ...data }); }); },
    delete: (ref: Ref) => { ops.push(() => { table(parent(ref.path)).delete(ref.id!); }); },
    commit: async () => { ops.forEach(op => op()); notify(); },
  };
};
