/**
 * 8 characters from Crockford base32 minus the ambiguous ones, so a share id
 * survives being read aloud or retyped from a screenshot. No dependency: this
 * is one `crypto.getRandomValues` call, and the design's suggested `nanoid`
 * would be a package for eight characters.
 *
 * Rejection sampling rather than a modulo, which would make the first eight
 * letters fractionally likelier — irrelevant for collisions at this size, but
 * the biased version is the one people copy into places where it matters.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
export const SHARE_ID_LENGTH = 8;
export const SHARE_ID_PATTERN = /^[0-9a-hjkmnp-tv-z]{8}$/;

export function createShareId(): string {
  const out: string[] = [];
  const buffer = new Uint8Array(SHARE_ID_LENGTH * 2);
  while (out.length < SHARE_ID_LENGTH) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (out.length === SHARE_ID_LENGTH) {
        break;
      }
      if (byte < 256 - (256 % ALPHABET.length)) {
        out.push(ALPHABET[byte % ALPHABET.length] as string);
      }
    }
  }
  return out.join('');
}

export function shareUrl(shareId: string): string {
  return `amrapwithfriends.com/s/${shareId}`;
}
