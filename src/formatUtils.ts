// Собирает отображаемую строку цены из числа и валюты; пустая строка, если сумма не введена или некорректна
export function formatPrice(amount: string, currency: string): string {
  const n = Number(amount.trim().replace(',', '.'));
  if (!amount.trim() || !Number.isFinite(n) || n < 0) return '';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

// Валюта из og:price:currency (ISO-код) в символ, принятый в форме
export function currencyFromCode(code?: string | null): string | null {
  if (code === 'RUB') return '₽';
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return null;
}

export const MIN_BIRTH_YEAR = 1900;

// Сегодняшняя дата в формате <input type="date"> (по местному времени, не UTC)
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Текст ошибки для даты рождения или null (пустое значение — не ошибка, его объясняет подсказка у кнопки)
export function birthdateProblem(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Проверьте дату';
  if (Number(value.slice(0, 4)) < MIN_BIRTH_YEAR) return `Укажите год не раньше ${MIN_BIRTH_YEAR}`;
  if (value > todayISO()) return 'Дата рождения не может быть в будущем';
  return null;
}

// 'YYYY-MM-DD' → '14.11.1998'. Разбираем вручную: new Date('YYYY-MM-DD') считает дату в UTC
// и западнее Гринвича показал бы предыдущий день
export function formatBirthdate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}

// Дней до ближайшего дня рождения; birthdate — 'YYYY-MM-DD' (значение <input type="date">)
export function daysUntilBirthday(birthdate?: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate || '');
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), month, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month, day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function birthdayLabel(days: number): string {
  if (days === 0) return 'Сегодня день рождения! 🎉';
  if (days === 1) return 'День рождения завтра 🎂';
  return `День рождения через ${days} дн. 🎂`;
}
