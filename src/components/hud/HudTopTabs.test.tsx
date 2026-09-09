import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HudTopTabs, type HudTabDefinition, type HudTabKey } from './HudTopTabs';

afterEach(() => {
  cleanup();
});

const tabs: readonly HudTabDefinition[] = [
  { key: 'mission-health', label: 'Mission Health' },
  { key: 'week-history', label: 'Week History' },
  { key: 'domains', label: 'Domains' },
  { key: 'benchmarks', label: 'Benchmarks' },
  { key: 'physical-activity', label: 'Physical Activity' },
];

describe('HudTopTabs', () => {
  it('renders the five HUD sections and marks the active one selected', () => {
    render(
      <HudTopTabs
        tabs={tabs}
        activeTab="mission-health"
        onChange={vi.fn<(tab: HudTabKey) => void>()}
      />
    );

    expect(screen.getByRole('tablist', { name: 'HUD sections' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Mission Health' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Week History' }).getAttribute('aria-selected')).toBe(
      'false'
    );
  });

  it('notifies the parent when another tab is chosen', () => {
    const onChange = vi.fn<(tab: HudTabKey) => void>();
    render(<HudTopTabs tabs={tabs} activeTab="mission-health" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Domains' }));

    expect(onChange).toHaveBeenCalledWith('domains');
  });
});
