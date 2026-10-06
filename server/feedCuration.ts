import type { TakprodamOffer } from './takprodam.js';

// Чистит сырой фид Такпродам перед тем, как он попадёт в свайп-колоду: без этого в карточках
// регулярно всплывал дешёвый хлам (стельки, крепёж, бытовая мелочёвка) и повторы одной и той же
// модели под разными SKU (цвет/размер) — см. жалобу "много дублей и мусорных товаров".
// Отдельно от isKidsProduct/isTrackable в takprodam.ts: те чистят по другим признакам (детское,
// недоступный для трекинга маркетплейс) ещё на этапе загрузки с API, а это — финальная зачистка
// перед показом конкретному пользователю (учитывает его seen_ids).

const MIN_PRICE_RUB = 1000;
const DECK_SIZE = 20;

// Базовый список — не исчерпывающий NLP-классификатор, а подборка по реальным жалобам на
// конкретные категории хлама. Дополнять по мере появления новых жалоб, а не усложнять алгоритм.
const STOP_WORDS = [
  // Одежда и обувь — расходники/мелочёвка, не самостоятельный подарок
  'стельки', 'шнурки', 'вешалка', 'вешалки', 'прищепки', 'пуговицы',
  // Автозапчасти и крепёж
  'прокладка', 'сальник', 'подшипник', 'втулка', 'саморез', 'дюбель',
  'переходник', 'разъем', 'разъём', 'предохранитель', 'тормозные колодки',
  'амортизатор', 'свеча зажигания', 'ремень грм',
  // Бытовая мелочёвка/расходники
  'губка для посуды', 'мешки для мусора', 'туалетная бумага', 'хозяйственное мыло',
  'стиральный порошок', 'швабра', 'веник', 'совок',
];

function hasStopWord(title: string): boolean {
  const lower = title.toLowerCase();
  return STOP_WORDS.some((word) => lower.includes(word));
}

// Грубый ключ "той же модели": первые два слова названия без учёта регистра. Не идеально отличает
// разные товары с одинаковым началом названия, но для партнёрского фида — где одна модель почти
// всегда плодит десятки SKU на цвет/размер с идентичным началом заголовка — этого достаточно и не
// требует сравнения полных названий или эмбеддингов ради карточек свайп-колоды.
function firstTwoWordsKey(title: string): string {
  return title.toLowerCase().trim().split(/\s+/).slice(0, 2).join(' ');
}

function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Порядок шагов важен: сперва отбрасываем просмотренное/дешёвое/мусорное (дёшево, O(n)), потом
// дедуп по оставшемуся "чистому" списку (иначе дубль мусорного товара мог бы вытеснить нормальный
// из той же группы), и только в конце — перемешивание и срез до DECK_SIZE, чтобы случайный порядок
// не влиял на то, какой из кандидатов одной группы попадёт в колоду.
export function curateFeedOffers(rawOffers: TakprodamOffer[], seenIds: Iterable<string>): TakprodamOffer[] {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds);

  const filtered = rawOffers.filter((offer) => {
    if (seen.has(offer.id)) return false;
    if (offer.price == null || offer.price < MIN_PRICE_RUB) return false;
    if (hasStopWord(offer.title)) return false;
    return true;
  });

  const seenKeys = new Set<string>();
  const deduped: TakprodamOffer[] = [];
  for (const offer of filtered) {
    const key = firstTwoWordsKey(offer.title);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(offer);
  }

  return shuffle(deduped).slice(0, DECK_SIZE);
}
