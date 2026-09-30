export const CURRENCY_OPTIONS = ['₽', '$', '€'] as const;

export const EMPTY_WISH = { title: '', priceAmount: '', priceCurrency: '₽' as string, link: '', imageUrl: '', note: '', groupId: 'unassigned' };

export type WishFormState = typeof EMPTY_WISH;
