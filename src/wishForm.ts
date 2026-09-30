export const MAX_WISH_INTERESTS = 3;

export const CURRENCY_OPTIONS = ['₽', '$', '€'] as const;

export const EMPTY_WISH = { title: '', priceAmount: '', priceCurrency: '₽' as string, link: '', imageUrl: '', note: '', groupId: 'unassigned', interests: [] as string[], shareToIdeas: false as boolean };

export type WishFormState = typeof EMPTY_WISH;
