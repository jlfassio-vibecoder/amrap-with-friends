import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WorkoutTemplateCard } from './WorkoutTemplateCard';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { HudClassification } from '@/lib/hud/types';

afterEach(() => {
  cleanup();
});

const template: WorkoutTemplate = {
  id: 'test-crucible',
  name: 'Test Crucible',
  durationMinutes: 10,
  category: 'four-point-cascade',
  intensityTier: 5,
  movements: [{ name: 'Burpees', reps: 10 }],
  tacticalNote: 'Keep moving.',
};

const operatorOpen: HudClassification = {
  current: 'operator',
  previous: 'civilian',
  progress: {
    weekMinutes: 250,
    intensity3PlusCount: 2,
    intensity4PlusCount: 1,
    marathon20Count: 0,
  },
};

describe('WorkoutTemplateCard', () => {
  it('shows a mandate badge when classification requires the template', () => {
    render(
      <WorkoutTemplateCard
        template={template}
        selected={false}
        classification={operatorOpen}
        onSelect={() => undefined}
      />
    );

    expect(screen.getByTestId('mandate-badge').textContent).toBe('MANDATE: TIER 4+');
  });

  it('hides the mandate badge when classification is null', () => {
    render(
      <WorkoutTemplateCard
        template={template}
        selected={false}
        classification={null}
        onSelect={() => undefined}
      />
    );

    expect(screen.queryByTestId('mandate-badge')).toBeNull();
  });
});
