// Тонкая обёртка над сгенерированным SDK SQL Connect (см. dataconnect/): даёт те же формы данных,
// что сейчас использует приложение при работе с Firestore. В интерфейс пока не подключена.
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myFriendships, joinWishlist, leaveWishlist, ideasByInterests } from '@dataconnect/generated';
import type { Profile } from './types';

export const sqlDb = getDataConnect(connectorConfig);

export interface FriendRow {
  ownerId: string;
  createdAt: number;
  profile: Profile;
}

// Друзья текущего пользователя: вишлисты, к которым он присоединился, вместе с профилем владельца
export async function loadMyFriends(): Promise<FriendRow[]> {
  const { data } = await myFriendships(sqlDb);
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

export const joinFriendWishlist = (ownerUid: string) => joinWishlist(sqlDb, { ownerUid });
export const leaveFriendWishlist = (ownerUid: string) => leaveWishlist(sqlDb, { ownerUid });

// «Идеи от людей»: желания других, разрешённые к показу, без данных владельца
export async function loadCommunityIdeas(interests: string[], limit = 50) {
  const { data } = await ideasByInterests(sqlDb, { interests, limit });
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
