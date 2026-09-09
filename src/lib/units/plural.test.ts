import { describe, expect, it } from 'vitest';
import { countOf, pluralise } from '@/lib/units/plural';

describe('pluralise', () => {
  it('keeps the singular at exactly one', () => {
    expect(pluralise(1, 'round')).toBe('round');
  });

  it('pluralises zero, which English treats as plural', () => {
    expect(pluralise(0, 'round')).toBe('rounds');
  });

  it('pluralises anything above one', () => {
    expect(pluralise(2, 'round')).toBe('rounds');
    expect(pluralise(11, 'round')).toBe('rounds');
  });

  it('takes an irregular plural when the word needs one', () => {
    expect(pluralise(1, 'person', 'people')).toBe('person');
    expect(pluralise(3, 'person', 'people')).toBe('people');
  });

  it('reads the magnitude, so a negative one is still singular', () => {
    // No call site produces one today, but "-1 rounds" is the same bug.
    expect(pluralise(-1, 'round')).toBe('round');
  });
});

describe('countOf', () => {
  it('joins the count to the right form', () => {
    expect(countOf(1, 'round')).toBe('1 round');
    expect(countOf(7, 'round')).toBe('7 rounds');
    expect(countOf(0, 'round')).toBe('0 rounds');
  });
});
