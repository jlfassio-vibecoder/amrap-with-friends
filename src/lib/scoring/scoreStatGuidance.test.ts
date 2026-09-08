import { describe, expect, it } from 'vitest';
import { getScoreStatGuidance, type ScoreStatId } from '@/lib/scoring/scoreStatGuidance';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';

const STAT_IDS: ScoreStatId[] = [
  'finalScore',
  'baseScore',
  'pviMultiplier',
  'domainWeight',
  'pviVariance',
  'pacingClassification',
];

describe('getScoreStatGuidance', () => {
  it.each(STAT_IDS)('gives every section non-empty plain-English copy for %s', (id) => {
    const guidance = getScoreStatGuidance(id);
    expect(guidance.title.length).toBeGreaterThan(0);
    expect(guidance.whatItIs.length).toBeGreaterThan(0);
    expect(guidance.howItsCalculated.length).toBeGreaterThan(0);
    expect(guidance.whatItMeasures.length).toBeGreaterThan(0);
    expect(guidance.howToUseIt.length).toBeGreaterThan(0);
  });

  it('titles match the labels shown on the scorecard', () => {
    expect(getScoreStatGuidance('finalScore').title).toBe('Final score');
    expect(getScoreStatGuidance('baseScore').title).toBe('Base score');
    expect(getScoreStatGuidance('domainWeight').title).toBe('Domain');
  });

  describe('the band tables', () => {
    it('reads the multiplier table straight from getPviMultiplier, not a hand-copied value', () => {
      const rows = getScoreStatGuidance('pviMultiplier').table?.rows ?? [];
      expect(rows).toHaveLength(4);
      expect(rows[0]).toEqual({ label: 'Under 10%', value: '× 1.15' });
      expect(rows[1]).toEqual({ label: '10–19%', value: '× 1' });
      expect(rows[2]).toEqual({ label: '20–29%', value: '× 0.95' });
      expect(rows[3]).toEqual({ label: '30% and up', value: '× 0.85' });
    });

    it('reads the classification table straight from getPviMultiplier too', () => {
      const rows = getScoreStatGuidance('pacingClassification').table?.rows ?? [];
      expect(rows.map((row) => row.value)).toEqual([
        'Elite Pacing',
        'Standard',
        'Power Leak',
        'System Failure',
      ]);
    });

    it('stays correct even if the band ceilings move, because it samples getPviMultiplier directly', () => {
      // Not a snapshot of today's numbers: re-derive what the table *should*
      // say from the same function it is built from, at the same sample
      // points, so this test would still pass after a ceiling change and
      // only fail if the table stopped tracking the function.
      const eliteSample = 0;
      const standardSample = 15;
      const powerLeakSample = 25;
      const systemFailureSample = 35;

      const expectedMultipliers = [
        eliteSample,
        standardSample,
        powerLeakSample,
        systemFailureSample,
      ].map((percent) => getPviMultiplier(percent).multiplier);
      const rows = getScoreStatGuidance('pviMultiplier').table?.rows ?? [];
      expect(rows.map((row) => row.value)).toEqual(
        expectedMultipliers.map((multiplier) => `× ${Number(multiplier.toFixed(2))}`)
      );
    });
  });

  it('only the two band-based stats carry a reference table', () => {
    expect(getScoreStatGuidance('finalScore').table).toBeUndefined();
    expect(getScoreStatGuidance('baseScore').table).toBeUndefined();
    expect(getScoreStatGuidance('domainWeight').table).toBeUndefined();
    expect(getScoreStatGuidance('pviVariance').table).toBeUndefined();
    expect(getScoreStatGuidance('pviMultiplier').table).toBeDefined();
    expect(getScoreStatGuidance('pacingClassification').table).toBeDefined();
  });

  describe('baseScore wording', () => {
    it('calls it reps when repsPerRound is not given, the common case', () => {
      const guidance = getScoreStatGuidance('baseScore');
      expect(guidance.whatItMeasures).toBe('Volume — the total reps you completed, nothing else.');
      expect(guidance.howItsCalculated).toContain('reps per round');
    });

    it('calls it reps for a reps-countable workout', () => {
      const guidance = getScoreStatGuidance('baseScore', { repsPerRound: 40 });
      expect(guidance.whatItMeasures).toBe('Volume — the total reps you completed, nothing else.');
      expect(guidance.howItsCalculated).toContain('reps per round');
    });

    it('calls it rounds for a round-based workout, never claims it measures reps', () => {
      const guidance = getScoreStatGuidance('baseScore', { repsPerRound: 0 });
      expect(guidance.whatItMeasures).toBe(
        'Volume — the total rounds you completed, nothing else.'
      );
      // "reps per round" would claim a rep total this workout doesn't have;
      // "the round in progress" would claim a partial-reps term that
      // computeBaseScore never adds for a round-based score. The wording is
      // still allowed to say the word "reps" while explaining it doesn't apply.
      expect(guidance.howItsCalculated).not.toContain('reps per round');
      expect(guidance.howItsCalculated).not.toContain('partial reps of the round in progress');
      expect(guidance.whatItMeasures).not.toContain('reps');
    });

    it('keeps the same title and how-to-use-it regardless of workout type', () => {
      const reps = getScoreStatGuidance('baseScore', { repsPerRound: 40 });
      const rounds = getScoreStatGuidance('baseScore', { repsPerRound: 0 });
      expect(reps.title).toBe(rounds.title);
      expect(reps.howToUseIt).toBe(rounds.howToUseIt);
    });
  });
});
