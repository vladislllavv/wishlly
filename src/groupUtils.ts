// Общие правила для названий групп (используются и в основном экране, и во вкладке «Идеи»)

export const GROUP_NAME_MAX = 100; // совпадает с лимитом в firestore.rules

// Ключ для сравнения названий: без регистра, «ё» = «е», без эмодзи и знаков препинания —
// «День рождения 🥳» и «день рождения» считаются одной и той же группой
export function groupKey(name: string): string {
  return name.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}
