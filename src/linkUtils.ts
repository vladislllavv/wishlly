// Открываем только http(s)-ссылки — защита от javascript: и прочих схем
export function isSafeLink(link?: string): boolean {
  return !!link && /^https?:\/\//i.test(link);
}

// Пользователь мог вставить ссылку с пробелами по краям или схемой в верхнем регистре ("HTTPS://…"):
// а правила Firestore проверяют `^https?://` с учётом регистра — поэтому обрезаем пробелы и приводим схему к нижнему
export function normalizeLink(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, m => m.toLowerCase());
}

// Текст ошибки для поля «Ссылка» или null, если ссылка пуста (она необязательна) или корректна
export function linkProblem(raw: string): string | null {
  const link = raw.trim();
  if (!link) return null;
  if (/\s/.test(link)) return 'В ссылке не должно быть пробелов';
  if (!/^https?:\/\/[^\s/]+/i.test(link)) return 'Ссылка должна начинаться с http:// или https://';
  return null;
}

// Понятная причина, почему не сработало автозаполнение. Сервер отдаёт `error` вроде «Страница недоступна (403)»,
// где в скобках — статус магазина; клиент раньше выбрасывал это и показывал один и тот же текст на всё
export function describeParseLinkFailure(error: any): string {
  const manual = ' — заполните вручную';
  if (error?.name === 'AbortError' || error?.status === 504) return `Страница отвечает слишком долго${manual}`;
  if (error?.name === 'TypeError') return 'Нет связи с сервером. Проверьте интернет';
  if (error?.status === 400) return 'Проверьте ссылку: её не удалось открыть';
  if (error?.status === 502) {
    const upstream = Number(/\((\d{3})\)/.exec(String(error.serverMessage || ''))?.[1]);
    if ([401, 403, 429, 498].includes(upstream)) return `Магазин не отдаёт данные автоматически${manual}`;
    if (upstream === 404 || upstream === 410) return 'Страница не найдена. Проверьте ссылку';
    return `Страница недоступна${manual}`;
  }
  return `Не удалось получить данные по ссылке${manual}`;
}
