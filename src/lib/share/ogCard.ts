export type OgCard = 'f' | 'm';

/** Map athlete biological sex to an OG card. Guests / missing / non-M → female. */
export function ogCardFromSex(sex: 'M' | 'F' | null | undefined): OgCard {
  return sex === 'M' ? 'm' : 'f';
}

/** Set or replace the `card` query param on an absolute or relative URL. */
export function withOgCard(url: string, card: OgCard): string {
  const parsed = new URL(url, 'https://amrapwithfriends.com');
  parsed.searchParams.set('card', card);
  if (/^https?:\/\//i.test(url)) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Site-relative path for the card PNG. */
export function ogImagePath(card: OgCard): string {
  return `/og-image-${card}.png`;
}

/** Absolute OG image URL for meta tags. */
export function ogImageAbsoluteUrl(origin: string, card: OgCard): string {
  return `${origin.replace(/\/$/, '')}${ogImagePath(card)}`;
}

/** Parse `card` from a query string value; anything other than `m` is female. */
export function parseOgCard(value: string | null | undefined): OgCard {
  return value === 'm' ? 'm' : 'f';
}
