import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionChainBuilder } from './MissionChainBuilder';
import type { ChainDraftItem } from '@/lib/mission/chainDraft';
import { formatRestSec, restAfterMissionSec } from '@/lib/mission/chainRest';

afterEach(() => {
  cleanup();
});

function item(
  overrides: Partial<ChainDraftItem> & Pick<ChainDraftItem, 'id' | 'name' | 'durationMinutes'>
): ChainDraftItem {
  return {
    intensityTier: 3,
    templateId: overrides.id,
    templateCap: overrides.durationMinutes,
    workout: [{ name: 'Burpees', target: 10 }],
    ...overrides,
  };
}

describe('MissionChainBuilder', () => {
  it('shows rest between rows and the long-not-last advisory', () => {
    const items = [
      item({ id: 'a', name: 'Long First', durationMinutes: 20, intensityTier: 3 }),
      item({ id: 'b', name: 'Short Second', durationMinutes: 5, intensityTier: 3 }),
    ];
    const rest = formatRestSec(restAfterMissionSec({ durationMinutes: 20, intensityTier: 3 }));

    render(
      <MissionChainBuilder
        items={items}
        canAdd={false}
        isAuthenticated
        onAdd={() => undefined}
        onMoveUp={() => undefined}
        onMoveDown={() => undefined}
        onRemove={() => undefined}
        onCapChange={() => undefined}
      />
    );

    expect(screen.getByText(`Rest ${rest}`)).toBeTruthy();
    expect(screen.getByText(/A mission this long is best left until last/i)).toBeTruthy();
  });

  it('disables Add to chain when canAdd is false and calls onAdd when enabled', () => {
    const onAdd = vi.fn();
    const { rerender } = render(
      <MissionChainBuilder
        items={[]}
        canAdd={false}
        isAuthenticated
        onAdd={onAdd}
        onMoveUp={() => undefined}
        onMoveDown={() => undefined}
        onRemove={() => undefined}
        onCapChange={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Add to chain' }).hasAttribute('disabled')).toBe(
      true
    );

    rerender(
      <MissionChainBuilder
        items={[]}
        canAdd
        isAuthenticated
        onAdd={onAdd}
        onMoveUp={() => undefined}
        onMoveDown={() => undefined}
        onRemove={() => undefined}
        onCapChange={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to chain' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('reorders and removes via the row controls', () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const onRemove = vi.fn();
    const items = [
      item({ id: 'a', name: 'Alpha', durationMinutes: 5 }),
      item({ id: 'b', name: 'Bravo', durationMinutes: 10 }),
    ];

    render(
      <MissionChainBuilder
        items={items}
        canAdd={false}
        isAuthenticated
        onAdd={() => undefined}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
        onCapChange={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move Bravo up' }));
    expect(onMoveUp).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: 'Move Alpha down' }));
    expect(onMoveDown).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('shows the sign-in hint for guests', () => {
    render(
      <MissionChainBuilder
        items={[]}
        canAdd={false}
        isAuthenticated={false}
        onAdd={() => undefined}
        onMoveUp={() => undefined}
        onMoveDown={() => undefined}
        onRemove={() => undefined}
        onCapChange={() => undefined}
      />
    );

    expect(screen.getByText('Sign in to chain missions')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to chain' })).toBeNull();
  });
});
