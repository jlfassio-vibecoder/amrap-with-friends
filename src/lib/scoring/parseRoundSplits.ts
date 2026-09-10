/**
 * Parse a free-typed list of round splits into seconds.
 *
 * The pacing calculator asks for something an athlete already has in front of
 * them — the lap times on a watch — so it accepts what they would actually
 * type: "1:12, 1:18 1:25", or plain seconds, separated by commas, spaces or
 * newlines. Anything unparseable is reported rather than silently dropped,
 * because a split quietly discarded would change the PVI without saying so.
 */
export interface ParsedRoundSplits {
  seconds: number[];
  invalid: string[];
}

const CLOCK = /^(\d{1,3}):([0-5]\d)(?:\.(\d{1,2}))?$/;
const SECONDS = /^\d{1,4}(?:\.\d{1,2})?$/;

export function parseRoundSplits(input: string): ParsedRoundSplits {
  const seconds: number[] = [];
  const invalid: string[] = [];

  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const clock = CLOCK.exec(token);
    if (clock) {
      const value =
        Number(clock[1]) * 60 + Number(clock[2]) + (clock[3] ? Number(`0.${clock[3]}`) : 0);
      if (value > 0) {
        seconds.push(value);
        continue;
      }
      invalid.push(token);
      continue;
    }

    if (SECONDS.test(token) && Number(token) > 0) {
      seconds.push(Number(token));
      continue;
    }

    invalid.push(token);
  }

  return { seconds, invalid };
}

export function formatSplit(totalSeconds: number): string {
  const whole = Math.round(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
