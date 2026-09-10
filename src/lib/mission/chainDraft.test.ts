import { describe, expect, it } from 'vitest';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import {
  appendTemplatesToChainDraft,
  capForChainedTemplate,
  reconcileChainDraft,
  templatesInCatalogOrder,
  templatesInSelectionOrder,
  type ChainDraftItem,
} from '@/lib/mission/chainDraft';
import { MAX_CHAIN_LENGTH } from '@/lib/mission/chainRest';

const piston = WORKOUT_TEMPLATES.find((template) => template.id === 'the-piston')!;
const metronome = WORKOUT_TEMPLATES.find((template) => template.durationMinutes === 10)!;

function draft(overrides: Partial<ChainDraftItem> & Pick<ChainDraftItem, 'id'>): ChainDraftItem {
  return {
    name: 'Row',
    durationMinutes: 5,
    intensityTier: 3,
    templateId: overrides.id,
    templateCap: 5,
    workout: [{ name: 'Burpees', target: 10 }],
    ...overrides,
  };
}

describe('capForChainedTemplate', () => {
  it('uses the page clock when the template is in the current domain', () => {
    expect(capForChainedTemplate(5, 3, 5)).toBe(3);
  });

  it('uses the template cap when search mixes domains', () => {
    expect(capForChainedTemplate(10, 3, 5)).toBe(10);
  });
});

describe('templatesInCatalogOrder', () => {
  it('returns selected templates in catalog order, not click order', () => {
    const later = WORKOUT_TEMPLATES[1]!;
    const earlier = WORKOUT_TEMPLATES[0]!;
    const ordered = templatesInCatalogOrder([later.id, earlier.id], WORKOUT_TEMPLATES);
    expect(ordered.map((template) => template.id)).toEqual([earlier.id, later.id]);
  });
});

describe('templatesInSelectionOrder', () => {
  it('keeps click order', () => {
    const later = WORKOUT_TEMPLATES[1]!;
    const earlier = WORKOUT_TEMPLATES[0]!;
    const ordered = templatesInSelectionOrder([later.id, earlier.id], WORKOUT_TEMPLATES);
    expect(ordered.map((template) => template.id)).toEqual([later.id, earlier.id]);
  });
});

describe('appendTemplatesToChainDraft', () => {
  it('appends in the given order and stops at the chain cap', () => {
    const full = Array.from({ length: MAX_CHAIN_LENGTH - 1 }, (_, index) =>
      draft({ id: `row-${index}` })
    );
    const next = appendTemplatesToChainDraft(full, [piston, metronome], 5, 5);
    expect(next).toHaveLength(MAX_CHAIN_LENGTH);
    expect(next[MAX_CHAIN_LENGTH - 1]?.templateId).toBe(piston.id);
  });

  it('applies the page clock to same-domain templates', () => {
    const next = appendTemplatesToChainDraft([], [piston], 3, 5);
    expect(next[0]?.durationMinutes).toBe(3);
    expect(next[0]?.templateCap).toBe(piston.durationMinutes);
  });
});

describe('reconcileChainDraft', () => {
  it('stays empty for a single pick', () => {
    expect(reconcileChainDraft([], [piston], 5, 5)).toEqual([]);
  });

  it('builds click-order rows once two or more are selected', () => {
    const next = reconcileChainDraft([], [piston, metronome], 5, 5);
    expect(next.map((item) => item.templateId)).toEqual([piston.id, metronome.id]);
  });

  it('keeps an existing row when reconciling', () => {
    const current = appendTemplatesToChainDraft([], [piston], 3, 5);
    const next = reconcileChainDraft(current, [piston, metronome], 5, 5);
    expect(next[0]?.id).toBe(current[0]?.id);
    expect(next[0]?.durationMinutes).toBe(3);
  });
});
