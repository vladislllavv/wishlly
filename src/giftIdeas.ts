// Локальный мок-каталог идей подарков для свайп-вкладки «Идеи».
// tags — названия интересов из INTEREST_CATEGORIES (interests.ts), по ним карточки
// подбираются под профиль пользователя. Это заглушка: в будущем заменится реальным
// источником (каталог/API), формат GiftIdea при этом можно сохранить.

export interface GiftIdea {
  id: string;
  title: string;
  emoji: string;
  price: string;
  tags: string[];
  // Заполняются только для реальных товаров из партнёрской выгрузки gdeslon (см. /api/gift-offers) —
  // у карточек мок-каталога ниже этих полей нет, компонент показывает emoji вместо картинки.
  imageUrl?: string;
  link?: string;
  priceAmount?: number | null;
  priceCurrency?: string;
}

// Товар из партнёрской выгрузки gdeslon.ru (см. server/gdeslon.ts) в формате карточки "Идей".
// Тегов интересов у него нет — подбор по интересам делает keyword-фильтр в pickOffersForInterests.
export function offerToGiftIdea(offer: { id: string; title: string; url: string; imageUrl: string | null; price: number | null; currency: string | null }): GiftIdea {
  return {
    id: `gdeslon_${offer.id}`,
    title: offer.title,
    emoji: '🎁',
    price: offer.price != null ? `${offer.price.toLocaleString('ru-RU')} ${offer.currency === 'RUR' || offer.currency === 'RUB' ? '₽' : offer.currency ?? ''}`.trim() : 'Цена уточняется',
    tags: [],
    imageUrl: offer.imageUrl ?? undefined,
    link: offer.url,
    priceAmount: offer.price,
    priceCurrency: offer.currency === 'RUR' ? 'RUB' : offer.currency ?? undefined,
  };
}

// Подбор среди реальных товаров: раз у офферов нет тегов интересов, ищем интерес как подстроку
// в названии товара (без учёта регистра). Если ничего не нашлось — как и в pickIdeasForInterests,
// отдаём всю колоду, чтобы вкладка не оставалась пустой.
export function pickOffersForInterests(offers: GiftIdea[], interests: string[]): GiftIdea[] {
  if (!interests.length) return offers;
  const needles = interests.map((i) => i.toLowerCase());
  const matched = offers.filter((offer) => needles.some((n) => offer.title.toLowerCase().includes(n)));
  return matched.length ? matched : offers;
}

export const GIFT_IDEAS: GiftIdea[] = [
  { id: 'i1', title: 'Беговые кроссовки премиум-класса', emoji: '👟', price: 'от 8 000 ₽', tags: ['Бег', 'Фитнес'] },
  { id: 'i2', title: 'Абонемент в бассейн на 3 месяца', emoji: '🏊', price: 'от 6 000 ₽', tags: ['Плавание', 'Фитнес'] },
  { id: 'i3', title: 'Коврик для йоги премиум', emoji: '🧘', price: 'от 3 000 ₽', tags: ['Йога', 'Медитация'] },
  { id: 'i4', title: 'Набор для домашних тренировок', emoji: '🏋️', price: 'от 5 000 ₽', tags: ['Фитнес', 'Единоборства'] },
  { id: 'i5', title: 'Скетчбук и набор маркеров', emoji: '🎨', price: 'от 2 500 ₽', tags: ['Рисование', 'Дизайн'] },
  { id: 'i6', title: 'Беззеркальный фотоаппарат', emoji: '📷', price: 'от 45 000 ₽', tags: ['Фотография'] },
  { id: 'i7', title: 'Наушники студийного качества', emoji: '🎧', price: 'от 12 000 ₽', tags: ['Музыка', 'Видеомонтаж'] },
  { id: 'i8', title: 'Гончарный круг для дома', emoji: '🏺', price: 'от 15 000 ₽', tags: ['Гончарное дело'] },
  { id: 'i9', title: 'Набор для каллиграфии', emoji: '✒️', price: 'от 2 000 ₽', tags: ['Каллиграфия'] },
  { id: 'i10', title: 'Умная колонка с ИИ-ассистентом', emoji: '🤖', price: 'от 7 000 ₽', tags: ['ИИ', 'Умный дом'] },
  { id: 'i11', title: 'Механическая клавиатура', emoji: '⌨️', price: 'от 9 000 ₽', tags: ['Программирование', 'Гаджеты'] },
  { id: 'i12', title: 'Комплект умных розеток', emoji: '🔌', price: 'от 3 500 ₽', tags: ['Умный дом'] },
  { id: 'i13', title: 'Конструктор дрона', emoji: '🛸', price: 'от 18 000 ₽', tags: ['Дроны', 'Робототехника'] },
  { id: 'i14', title: 'VR-гарнитура', emoji: '🥽', price: 'от 35 000 ₽', tags: ['VR и AR', 'Видеоигры'] },
  { id: 'i15', title: 'Стильный шарф из кашемира', emoji: '🧣', price: 'от 4 000 ₽', tags: ['Одежда', 'Аксессуары'] },
  { id: 'i16', title: 'Дизайнерские наручные часы', emoji: '⌚', price: 'от 15 000 ₽', tags: ['Часы', 'Аксессуары'] },
  { id: 'i17', title: 'Кожаная сумка ручной работы', emoji: '👜', price: 'от 10 000 ₽', tags: ['Сумки', 'Винтаж'] },
  { id: 'i18', title: 'Нишевый парфюм', emoji: '🌸', price: 'от 6 000 ₽', tags: ['Парфюмерия'] },
  { id: 'i19', title: 'Настольная ролевая игра', emoji: '🎲', price: 'от 3 500 ₽', tags: ['Настольные игры'] },
  { id: 'i20', title: 'Турнирный шахматный набор', emoji: '♟️', price: 'от 4 500 ₽', tags: ['Шахматы'] },
  { id: 'i21', title: 'Объёмный пазл-головоломка', emoji: '🧩', price: 'от 2 000 ₽', tags: ['Головоломки'] },
  { id: 'i22', title: 'Игровая мышь и коврик Pro', emoji: '🖱️', price: 'от 5 000 ₽', tags: ['Видеоигры', 'Киберспорт'] },
  { id: 'i23', title: 'Коллекционная фигурка из аниме', emoji: '🗿', price: 'от 3 000 ₽', tags: ['Аниме и манга', 'Коллекционирование'] },
  { id: 'i24', title: 'Набор для домашней пиццы', emoji: '🍕', price: 'от 3 000 ₽', tags: ['Кулинария', 'Выпечка'] },
  { id: 'i25', title: 'Ручная кофемолка', emoji: '☕', price: 'от 4 500 ₽', tags: ['Кофе'] },
  { id: 'i26', title: 'Набор для заваривания чая', emoji: '🍵', price: 'от 2 500 ₽', tags: ['Чай'] },
  { id: 'i27', title: 'Портативный гриль', emoji: '🔥', price: 'от 8 000 ₽', tags: ['Гриль и барбекю'] },
  { id: 'i28', title: 'Дегустационный набор крафтового пива', emoji: '🍺', price: 'от 3 500 ₽', tags: ['Крафтовое пиво'] },
  { id: 'i29', title: 'Туристический рюкзак 40л', emoji: '🎒', price: 'от 9 000 ₽', tags: ['Путешествия', 'Походы'] },
  { id: 'i30', title: 'Палатка для кемпинга', emoji: '⛺', price: 'от 12 000 ₽', tags: ['Кемпинг'] },
  { id: 'i31', title: 'Набор для ухода за растениями', emoji: '🪴', price: 'от 2 500 ₽', tags: ['Садоводство', 'Комнатные растения'] },
  { id: 'i32', title: 'Компактная удочка для рыбалки', emoji: '🎣', price: 'от 5 000 ₽', tags: ['Рыбалка'] },
  { id: 'i33', title: 'Ароматические свечи, набор', emoji: '🕯️', price: 'от 2 000 ₽', tags: ['Свечи и ароматы'] },
  { id: 'i34', title: 'Плед из органического хлопка', emoji: '🛋️', price: 'от 3 500 ₽', tags: ['Домашний текстиль', 'Интерьер'] },
  { id: 'i35', title: 'Дизайнерская настольная лампа', emoji: '💡', price: 'от 6 000 ₽', tags: ['Освещение', 'Декор'] },
  { id: 'i36', title: 'Электронная книга', emoji: '📖', price: 'от 10 000 ₽', tags: ['Книги'] },
  { id: 'i37', title: 'Подборка классики мирового кино на виниле', emoji: '🎬', price: 'от 4 000 ₽', tags: ['Кино'] },
  { id: 'i38', title: 'Билеты в театр', emoji: '🎭', price: 'от 3 000 ₽', tags: ['Театр'] },
  { id: 'i39', title: 'Курс иностранного языка', emoji: '🗣️', price: 'от 5 000 ₽', tags: ['Иностранные языки'] },
  { id: 'i40', title: 'Телескоп для новичка', emoji: '🔭', price: 'от 14 000 ₽', tags: ['Астрономия'] },
  { id: 'i41', title: 'Массажёр для лица', emoji: '💆', price: 'от 3 500 ₽', tags: ['Спа и массаж', 'Уход за кожей'] },
  { id: 'i42', title: 'Набор натуральной косметики', emoji: '🧴', price: 'от 4 000 ₽', tags: ['Уход за кожей', 'Косметика'] },
  { id: 'i43', title: 'Диффузор для ароматерапии', emoji: '🌿', price: 'от 2 800 ₽', tags: ['Ароматерапия'] },
  { id: 'i44', title: 'Подарочный сертификат в барбершоп', emoji: '💈', price: 'от 2 500 ₽', tags: ['Барбершоп'] },
];

export interface SwipeRecord {
  ideaId: string;
  liked: boolean;
}

// tag -> вес, положительный от лайков, отрицательный от дизлайков
export type TagWeights = Record<string, number>;

const IDEA_BY_ID = new Map(GIFT_IDEAS.map((idea) => [idea.id, idea]));

// Лайк идеи прибавляет вес её тегам, дизлайк — вычитает: колода со временем подстраивается
// под то, что пользователь реально выбирает, а не только под теги, отмеченные в профиле.
export function computeTagWeights(swipes: SwipeRecord[]): TagWeights {
  const weights: TagWeights = {};
  for (const { ideaId, liked } of swipes) {
    const idea = IDEA_BY_ID.get(ideaId);
    if (!idea) continue;
    const delta = liked ? 1 : -1;
    for (const tag of idea.tags) {
      weights[tag] = (weights[tag] || 0) + delta;
    }
  }
  return weights;
}

// Чем больше тегов идеи совпадает с интересами пользователя и чем выше их вес по истории
// свайпов, тем раньше идея показывается в колоде.
function matchScore(idea: GiftIdea, interests: string[], tagWeights: TagWeights): number {
  return idea.tags.reduce((score, tag) => {
    const interestBonus = interests.includes(tag) ? 1 : 0;
    return score + interestBonus + (tagWeights[tag] || 0);
  }, 0);
}

export function pickIdeasForInterests(interests: string[], tagWeights: TagWeights = {}): GiftIdea[] {
  if (!interests.length && Object.keys(tagWeights).length === 0) return GIFT_IDEAS;
  const matched = GIFT_IDEAS
    .map((idea) => ({ idea, score: matchScore(idea, interests, tagWeights) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.idea);
  return matched.length ? matched : GIFT_IDEAS;
}

// У желаний, добавленных свайпом, нет фото товара (каталог идей — эмодзи-заглушки, не реальные ссылки).
// Без этого поля карточка желания падает на общий значок-подарок и теряет узнаваемость идеи —
// вместо этого превращаем эмодзи в маленькую SVG-картинку, которую понимает обычный <img src>.
export function ideaImageUrl(idea: GiftIdea): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">`
    + `<rect width="200" height="200" fill="#fdf2f8"/>`
    + `<text x="50%" y="54%" font-size="104" text-anchor="middle" dominant-baseline="middle">${idea.emoji}</text>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
