/**
 * "1 round", not "1 rounds".
 *
 * Seven places built this string with a hardcoded `s`, and every one of them
 * read "1 rounds" on a mission where the athlete managed a single round —
 * including the share card and the link-preview title, which are the two
 * surfaces a stranger sees first.
 *
 * English only, and deliberately so: the product has no localisation, and a
 * function that pretended to handle plurals in general would be a worse lie
 * than one that says what it does. `plural` is the irregular form when the
 * word needs one.
 */
export function pluralise(count: number, singular: string, plural?: string): string {
  return Math.abs(count) === 1 ? singular : (plural ?? `${singular}s`);
}

/** The count and its noun together, which is what every call site actually wanted. */
export function countOf(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralise(count, singular, plural)}`;
}
