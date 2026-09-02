import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkoutTemplateCard } from './WorkoutTemplateCard';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { HudClassification } from '@/lib/hud/types';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';

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

const futureLock: TemplateRecoveryLock = {
  templateId: 'test-crucible',
  reason: 'severe-intensity',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
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

  it('does not call onSelect when locked', () => {
    const onSelect = vi.fn();

    render(
      <WorkoutTemplateCard
        template={template}
        selected={false}
        classification={operatorOpen}
        smartRecoveryActive
        recoveryLock={futureLock}
        onSelect={onSelect}
      />
    );

    const card = screen.getByText('Test Crucible').closest('[role="button"]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('recovery-lock-message')).toBeTruthy();
    expect(screen.getByTestId('mandate-badge')).toBeTruthy();

    fireEvent.click(card!);
    fireEvent.keyDown(card!, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect when unlocked', () => {
    const onSelect = vi.fn();

    render(<WorkoutTemplateCard template={template} selected={false} onSelect={onSelect} />);

    const card = screen.getByText('Test Crucible').closest('[role="button"]');
    fireEvent.click(card!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(template);
  });
});
