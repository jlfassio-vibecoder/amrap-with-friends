import { describe, expect, it } from 'vitest';
import { AMQAP_FLOW_CATEGORIES, AMQAP_FLOWS } from '@/data/amqapFlows';
import { amqapCategoryById, filterAmqapFlows } from './filterAmqapFlows';

describe('filterAmqapFlows', () => {
  it('returns one flow per family at each AMQAP clock', () => {
    for (const category of AMQAP_FLOW_CATEGORIES) {
      expect(
        filterAmqapFlows(AMQAP_FLOWS, { durationMinutes: 10, flowId: category.id })
      ).toHaveLength(1);
      expect(
        filterAmqapFlows(AMQAP_FLOWS, { durationMinutes: 15, flowId: category.id })
      ).toHaveLength(1);
    }
  });

  it('keeps 10- and 15-minute versions of the same family distinct', () => {
    const ten = filterAmqapFlows(AMQAP_FLOWS, { durationMinutes: 10, flowId: 'foundational' });
    const fifteen = filterAmqapFlows(AMQAP_FLOWS, { durationMinutes: 15, flowId: 'foundational' });
    expect(ten[0]?.id).toBe('amqap-foundational-10');
    expect(fifteen[0]?.id).toBe('amqap-foundational-15');
    expect(ten[0]?.intensityTier).toBe(1);
    expect(ten[0]?.movements.every((movement) => movement.reps !== undefined)).toBe(true);
  });

  it('is empty when the catalog has no match', () => {
    expect(filterAmqapFlows([], { durationMinutes: 10, flowId: 'spinal' })).toEqual([]);
  });
});

describe('amqapCategoryById', () => {
  it('returns the chip copy for a known family', () => {
    expect(amqapCategoryById('deep-hip')?.label).toBe('Deep hip');
  });
});
