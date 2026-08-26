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

function titleCaseWord(word: string): string {
  if (word.length === 0) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** intake_submitted → "Intake submitted"; blood-shunt → "Blood shunt" */
export function formatCoachLabel(value: string): string {
  if (!value.trim()) {
    return value;
  }
  const words = value.split(/[_-]+/).filter(Boolean).map((word) => word.toLowerCase());
  if (words.length === 0) {
    return value;
  }
  words[0] = titleCaseWord(words[0]);
  return words.join(' ');
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

/** For rpc_call rows: "Rpc call · Upsert athlete profile" */
export function formatCoachEventLabel(
  eventName: string,
  props: Record<string, unknown>
): string {
  const label = formatCoachLabel(eventName);
  if (eventName === 'rpc_call' && typeof props.rpc_name === 'string') {
    return `${label} · ${formatCoachLabel(props.rpc_name)}`;
  }
  return label;
}

/** Props column: humanize keys and slug-like string values for readable JSON */
export function formatCoachProps(props: Record<string, unknown>): string {
  return JSON.stringify(formatCoachPropsObject(props));
}
