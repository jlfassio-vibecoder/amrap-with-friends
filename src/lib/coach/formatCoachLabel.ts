/** Slug-like analytics strings: snake_case, kebab-case words, or single lowercase tokens. */
function isSlugLikeString(value: string): boolean {
  if (value.includes('_')) {
    return /^[a-z][a-z0-9_]*$/.test(value);
  }
  if (value.includes('-')) {
    return /^[a-z]+(-[a-z]+)+$/.test(value);
  }
  return /^[a-z][a-z0-9]*$/.test(value);
}

/**
 * Tokens that are acronyms, not words. Without these, Explore rows read
 * "Rpc call", "Mission id copied" and "Featured wod viewed" — the last one
 * mangling an acronym the coach surface is allowed to use (CLAUDE.md keeps WOD
 * in coach-facing tooling and out of anything a first-time visitor reads).
 */
const ACRONYMS = new Set(['wod', 'wods', 'rpc', 'id', 'ids', 'url', 'ui', 'pvi', 'amrap']);

function titleCaseWord(word: string): string {
  if (word.length === 0) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Show a copyable full UUID in title; keep the cell to 8…4. */
export function truncateAnonId(anonId: string): string {
  if (anonId.length <= 12) {
    return anonId;
  }
  return `${anonId.slice(0, 8)}…${anonId.slice(-4)}`;
}

/** intake_submitted → "Intake submitted"; blood-shunt → "Blood shunt" */
export function formatCoachLabel(value: string): string {
  if (!value.trim()) {
    return value;
  }
  const words = value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  if (words.length === 0) {
    return value;
  }
  const cased = words.map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  cased[0] = ACRONYMS.has(words[0]) ? cased[0] : titleCaseWord(words[0]);
  return cased.join(' ');
}

function formatCoachPropValue(value: unknown): unknown {
  if (typeof value === 'string' && isSlugLikeString(value)) {
    return formatCoachLabel(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatCoachPropValue);
  }
  if (value && typeof value === 'object') {
    return formatCoachPropsObject(value as Record<string, unknown>);
  }
  return value;
}

function formatCoachPropsObject(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      formatCoachLabel(key),
      formatCoachPropValue(value),
    ])
  );
}

/**
 * The prop that says *which* one, for events whose name alone is not enough to
 * read a row. Explore now lists every registered event rather than a curated
 * fifteen, so the feed is dense with repeated names — "Auth sign up failed"
 * four times running says nothing, "Auth sign up failed · Duplicate" says the
 * copy is sending returning users to the wrong form.
 */
const EVENT_DETAIL_PROP: Record<string, string> = {
  rpc_call: 'rpc_name',
  realtime_status: 'status',
  audio_unlock_result: 'state',
  template_selected: 'template_id',
  coach_workout_selected: 'template_id',
  auth_sign_up_failed: 'reason',
  auth_sign_in_failed: 'reason',
  auth_google_failed: 'reason',
};

/** For rpc_call rows: "RPC call · Upsert athlete profile" */
export function formatCoachEventLabel(eventName: string, props: Record<string, unknown>): string {
  const label = formatCoachLabel(eventName);
  const detailKey = EVENT_DETAIL_PROP[eventName];
  const detail = detailKey ? props[detailKey] : null;
  if (typeof detail === 'string' && detail.trim()) {
    return `${label} · ${formatCoachLabel(detail)}`;
  }
  return label;
}

/** Props column: humanize keys and slug-like string values for readable JSON */
export function formatCoachProps(props: Record<string, unknown>): string {
  return JSON.stringify(formatCoachPropsObject(props));
}
