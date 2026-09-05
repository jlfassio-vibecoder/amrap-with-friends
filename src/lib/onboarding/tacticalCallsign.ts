const CALLSIGN_PREFIXES = [
  'Ghost',
  'Viper',
  'Rogue',
  'Titan',
  'Reaper',
  'Shadow',
  'Nova',
  'Striker',
  'Raven',
  'Spectre',
  'Apex',
  'Bolt',
  'Cipher',
  'Drift',
  'Echo',
  'Falcon',
  'Havoc',
  'Iron',
  'Javelin',
  'Kestrel',
] as const;

const CALLSIGN_ROLE_SUFFIXES = [
  'Actual',
  'Leader',
  'One',
  'Prime',
  'Six',
  'Nine',
  'Zero',
  'Watch',
] as const;

export type AthleteIdentitySuggestion = {
  username: string;
  nickname: string;
};

/** Sanitize a display callsign into a legal athlete username. */
export function sanitizeCallsignUsername(nickname: string): string {
  const cleaned = nickname
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 30);
  }

  const padded = `${cleaned || 'op'}_1`;
  return padded.slice(0, 30);
}

export function isValidAthleteUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{3,30}$/.test(username);
}

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[Math.min(Math.max(index, 0), items.length - 1)]!;
}

/**
 * Build a tactical callsign nickname + sanitized username.
 * `random` is injectable for tests (defaults to Math.random).
 */
export function suggestAthleteIdentity(
  random: () => number = Math.random
): AthleteIdentitySuggestion {
  const prefix = pick(CALLSIGN_PREFIXES, random);
  const useRoleSuffix = random() < 0.55;
  const suffix = useRoleSuffix
    ? pick(CALLSIGN_ROLE_SUFFIXES, random)
    : String(1 + Math.floor(random() * 99));
  const nickname = `${prefix}-${suffix}`;
  const username = sanitizeCallsignUsername(nickname);
  return { username, nickname };
}

/** Regenerate until username is not in `taken` (case-insensitive), capped attempts. */
export function suggestAthleteIdentityAvoiding(
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
  maxAttempts = 40
): AthleteIdentitySuggestion {
  const takenLower = new Set([...taken].map((value) => value.toLowerCase()));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suggestion = suggestAthleteIdentity(random);
    if (!takenLower.has(suggestion.username.toLowerCase())) {
      return suggestion;
    }
  }
  const fallback = suggestAthleteIdentity(random);
  const stamp = String(Date.now() % 100000);
  const username = sanitizeCallsignUsername(`${fallback.username}_${stamp}`);
  return {
    username: isValidAthleteUsername(username) ? username : `op_${stamp}`.slice(0, 30),
    nickname: fallback.nickname,
  };
}
