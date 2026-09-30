export const REMINDER_DAYS = [14, 7];

export interface Holiday {
  key: string;
  month: number;
  day: number;
  // «через N дней — {title}»
  title: string;
}

export interface ReminderProfile {
  birthdate?: string;
  gender?: string;
}

export interface DueReminder {
  holiday: Holiday;
  daysBefore: number;
  // Год самого праздника (для ключа дедупликации)
  year: number;
}

export function holidaysFor(profile: ReminderProfile): Holiday[] {
  const list: Holiday[] = [];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthdate || '');
  if (m) list.push({ key: 'birthday', month: Number(m[2]), day: Number(m[3]), title: 'твой день рождения' });
  list.push({ key: 'new_year', month: 1, day: 1, title: 'Новый год' });
  if (profile.gender === 'Женский') list.push({ key: 'mar8', month: 3, day: 8, title: '8 Марта' });
  if (profile.gender === 'Мужской') list.push({ key: 'feb23', month: 2, day: 23, title: '23 Февраля' });
  return list;
}

// today — календарная дата в нужном часовом поясе; всё считаем в UTC, чтобы не зависеть от пояса сервера
export function nextOccurrence(holiday: Holiday, today: { y: number; m: number; d: number }) {
  const todayMs = Date.UTC(today.y, today.m - 1, today.d);
  let target = new Date(Date.UTC(today.y, holiday.month - 1, holiday.day));
  if (target.getTime() < todayMs) target = new Date(Date.UTC(today.y + 1, holiday.month - 1, holiday.day));
  return { days: Math.round((target.getTime() - todayMs) / 86400000), year: target.getUTCFullYear() };
}

export function dueReminders(profile: ReminderProfile, today: { y: number; m: number; d: number }): DueReminder[] {
  const due: DueReminder[] = [];
  for (const holiday of holidaysFor(profile)) {
    const { days, year } = nextOccurrence(holiday, today);
    if (REMINDER_DAYS.includes(days)) due.push({ holiday, daysBefore: days, year });
  }
  return due;
}

export function reminderText(reminder: DueReminder): string {
  return `Через ${reminder.daysBefore} дн. — ${reminder.holiday.title}. 🎁 Самое время обновить вишлист и поделиться ссылкой с друзьями, чтобы подарок выбирали из твоих желаний.`;
}

// Напоминание тому, кто присоединился к вишлисту: у владельца скоро день рождения
export function friendBirthdayReminders(
  owner: ReminderProfile,
  today: { y: number; m: number; d: number },
): { daysBefore: number; year: number }[] {
  const birthday = holidaysFor(owner).find((h) => h.key === 'birthday');
  if (!birthday) return [];
  const { days, year } = nextOccurrence(birthday, today);
  return REMINDER_DAYS.includes(days) ? [{ daysBefore: days, year }] : [];
}

export function friendReminderText(ownerName: string | undefined, daysBefore: number): string {
  const who = ownerName ? `у ${ownerName}` : 'у вашего друга';
  return `Через ${daysBefore} дн. ${who} день рождения. 🎂 Загляните в его вишлист и выберите подарок заранее.`;
}
