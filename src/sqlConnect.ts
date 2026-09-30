// Тонкая обёртка над сгенерированным SDK SQL Connect (см. dataconnect/): даёт те же формы данных,
// что сейчас использует приложение при работе с Firestore. В интерфейс пока не подключена.
import { getDataConnect, connectDataConnectEmulator, QueryFetchPolicy } from 'firebase/data-connect';
import { connectorConfig, myFriendships, joinWishlist, leaveWishlist, ideasByInterests, upsertMyProfile } from '@dataconnect/generated';
import type { Profile } from './types';

export const sqlDb = getDataConnect(connectorConfig);
// По умолчанию SDK отдаёт запросы из кэша; данные, которые мы сами меняем (друзья, идеи), читаем только с сервера
const fresh = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY };
if (import.meta.env.VITE_USE_EMULATORS === '1') connectDataConnectEmulator(sqlDb, '127.0.0.1', 9399);

export interface FriendRow {
  ownerId: string;
  createdAt: number;
  profile: Profile;
}

// Друзья текущего пользователя: вишлисты, к которым он присоединился, вместе с профилем владельца
export async function loadMyFriends(): Promise<FriendRow[]> {
  const { data } = await myFriendships(sqlDb, fresh);
  return data.friendships.map((f) => ({
    ownerId: f.owner.uid,
    createdAt: Date.parse(f.createdAt),
    profile: {
      firstName: f.owner.firstName ?? undefined,
      birthdate: f.owner.birthdate ?? '',
      gender: '',
    },
  }));
}

// Профиль пользователя создаётся в SQL лениво, перед первым действием, которое на него ссылается (например, «Присоединиться»)
export const ensureMyProfile = (p: { firstName?: string; birthdate?: string; gender?: string }) =>
  upsertMyProfile(sqlDb, {
    firstName: p.firstName || undefined,
    birthdate: p.birthdate || undefined,
    gender: p.gender && p.gender !== 'Не указано' ? p.gender : undefined,
    onboardingCompleted: true,
  });

export const joinFriendWishlist = (ownerUid: string) => joinWishlist(sqlDb, { ownerUid });
export const leaveFriendWishlist = (ownerUid: string) => leaveWishlist(sqlDb, { ownerUid });

// «Идеи от людей»: желания других, разрешённые к показу, без данных владельца
export async function loadCommunityIdeas(interests: string[], limit = 50) {
  const { data } = await ideasByInterests(sqlDb, { interests, limit }, fresh);
  return data.wishes.map((w) => ({
    id: w.id,
    title: w.title,
    priceAmount: w.priceAmount ?? null,
    priceCurrency: w.priceCurrency ?? undefined,
    link: w.link ?? undefined,
    imageUrl: w.imageUrl ?? undefined,
    interests: w.interests.map((i) => i.interest.name),
  }));
}
