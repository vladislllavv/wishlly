export interface Wish {
  id: string;
  title: string;
  price?: string; // готовая строка для отображения, например «5 000 ₽» — считается из priceAmount/priceCurrency
  priceAmount?: number | null;
  priceCurrency?: string;
  link?: string;
  imageUrl?: string;
  note?: string;
  groupId?: string;
  ownerId: string;
  ownerName?: string;
  createdAt: number;
  // Снимок интересов владельца на момент создания желания, без обращения к profiles.
  ownerInterests?: string[];
  // Какие интересы владельца закрывает желание (до 3) и разрешил ли он показывать его анонимно во вкладке «Идеи»
  interests?: string[];
  shareToIdeas?: boolean;
  // Кто забронировал — в отдельной коллекции reservations (см. firestore.rules), сюда не попадает:
  // владелец желания технически не может прочитать это поле даже из DevTools.
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: number;
}

export interface Profile {
  birthdate: string;
  gender: string;
  firstName?: string;
  interests?: string[];
  onboardingCompleted?: boolean;
  createdAt?: number;
}

// friendId подписался на вишлист ownerId (кнопка «Присоединиться»). Документ создаёт и удаляет только сам friendId.
export interface Friendship {
  id: string;
  ownerId: string;
  friendId: string;
  createdAt: number;
}

export interface GuestView {
  ownerId: string;
  groupId: string | null;
}
