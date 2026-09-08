import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const page = readFileSync(join(root, 'src/pages/MissionWaitingRoomPage.tsx'), 'utf8');

/**
 * The gauge stays a mounted component, never inline markup.
 *
 * Its first version interleaved a gauge and a checkbox into the clock block —
 * the element that also holds the countdown, Start, Log round and the audio cue
 * effect. That placement disabled the Space hotkey via a focused input, and
 * would have taken the whole mission down on any render error. Both are
 * properties of *where* it sat, so they come back the moment someone reaches
 * past `MissionPacingGauge` and drops the parts into the page again.
 */
describe('the pacing gauge is mounted, not inlined', () => {
  it('reaches the page through exactly one component', () => {
    expect(page).toContain('<MissionPacingGauge');
    expect(page.match(/<MissionPacingGauge/g) ?? []).toHaveLength(1);
  });

  it('does not pull the gauge’s parts into the page directly', () => {
    // Importing any of these into the page means the container has been
    // bypassed, and with it the boundary and the keep-inputs-out-of-work rule.
    for (const internal of [
      '@/components/mission/PacingGauge',
      '@/components/mission/MissionWidgetBoundary',
      '@/lib/pacing/pacingGaugePrefs',
      '@/lib/pacing/pacingGauge',
    ]) {
      expect(page).not.toContain(internal);
    }
  });

  it('sits outside the clock section, after Log round', () => {
    const lines = page.split('\n');
    const at = (needle: string) => lines.findIndex((line) => line.includes(needle));

    const clock = at('formatTime(live.timeLeftSec)');
    const logRound = at('onClick={handleLogRound}');
    const mount = at('<MissionPacingGauge');
    expect(clock).toBeGreaterThan(-1);
    expect(logRound).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(-1);

    // Where the clock's own <section> closes.
    let depth = 0;
    let close = -1;
    for (let i = clock; i < lines.length; i += 1) {
      depth += (lines[i].match(/<section/g) ?? []).length;
      depth -= (lines[i].match(/<\/section>/g) ?? []).length;
      if (depth < 0) {
        close = i;
        break;
      }
    }

    expect(close).toBeGreaterThan(-1);
    expect(mount, 'the gauge is back inside the clock block').toBeGreaterThan(close);
    expect(mount, 'the gauge is above the mission controls').toBeGreaterThan(logRound);
  });
});
