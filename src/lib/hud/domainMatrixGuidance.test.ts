import { describe, expect, it } from 'vitest';
import { DOMAIN_MATRIX_GUIDANCE, type DomainMatrixWindowLabel } from './domainMatrixGuidance';

const WINDOWS: DomainMatrixWindowLabel[] = ['72-hour', '7-day', '30-day'];

describe('DOMAIN_MATRIX_GUIDANCE', () => {
  it('covers every domain matrix window with a disclosure label and paragraphs', () => {
    for (const window of WINDOWS) {
      const guidance = DOMAIN_MATRIX_GUIDANCE[window];
      expect(guidance.disclosureLabel).toContain(window);
      expect(guidance.paragraphs.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('explains the shared bar and the 60% coaching guardrail on every window', () => {
    for (const window of WINDOWS) {
      const text = DOMAIN_MATRIX_GUIDANCE[window].paragraphs.join(' ');
      expect(text).toMatch(/share of your locked core minutes/i);
      expect(text).toMatch(/60%/);
      expect(text).toMatch(/coaching guardrail/i);
    }
  });
});
