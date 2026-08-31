import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { HostRallyPointSteps } from './HostRallyPointSteps';

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('@/lib/api/missionSync', () => ({
  setRallyPointCountdown: vi.fn().mockResolvedValue({ data: { ends_at: null }, error: null }),
  cancelRallyPointCountdown: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
}));

vi.mock('@/lib/missionIdentity', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/missionIdentity')>('@/lib/missionIdentity');
  return {
    ...actual,
    getStoredHostToken: () => 'host-token',
  };
});

vi.mock('@/components/GhostPicker', () => ({
  GhostPicker: () => <div data-testid="ghost-picker">Ghost picker</div>,
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: null,
    missing: false,
    loading: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSteps(overrides: Partial<ComponentProps<typeof HostRallyPointSteps>> = {}) {
  return render(
    <HostRallyPointSteps
      missionId={MISSION_ID}
      countdownArmed={false}
      actionsEnabled
      showPacer={false}
      templateId={null}
      durationMinutes={20}
      ghostSelection={null}
      onGhostChange={vi.fn()}
      {...overrides}
    />
  );
}

describe('HostRallyPointSteps', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://amrap.example' },
    });
  });

  it('expands Set duration by default when the clock is not armed', () => {
    renderSteps();
    const durationHeader = screen.getByRole('button', { name: /Set duration/i });
    expect(durationHeader.getAttribute('aria-expanded')).toBe('true');
    const startCountdown = screen.getByRole('button', { name: 'Start countdown' });
    expect(startCountdown).toBeTruthy();
    expect(startCountdown).toHaveProperty('disabled', true);
  });

  it('enables Start countdown only after a duration is chosen', () => {
    renderSteps();
    const startCountdown = screen.getByRole('button', { name: 'Start countdown' });
    expect(startCountdown).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: '5 MIN' }));
    expect(startCountdown).toHaveProperty('disabled', false);
  });

  it('starts with all steps collapsed when the clock is armed', () => {
    renderSteps({ countdownArmed: true });
    expect(
      screen.getByRole('button', { name: /Set duration/i }).getAttribute('aria-expanded')
    ).toBe('false');
    expect(screen.queryByRole('button', { name: 'Start countdown' })).toBeNull();
  });

  it('collapses the open step when countdownArmed becomes true', () => {
    const { rerender } = renderSteps({ countdownArmed: false });
    expect(
      screen.getByRole('button', { name: /Set duration/i }).getAttribute('aria-expanded')
    ).toBe('true');

    rerender(
      <HostRallyPointSteps
        missionId={MISSION_ID}
        countdownArmed
        actionsEnabled
        showPacer={false}
        templateId={null}
        durationMinutes={20}
        ghostSelection={null}
        onGhostChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /Set duration/i }).getAttribute('aria-expanded')
    ).toBe('false');
  });

  it('toggles accordion headers and expands only one step', () => {
    renderSteps();
    fireEvent.click(screen.getByRole('button', { name: /Share mission/i }));
    expect(
      screen.getByRole('button', { name: /Share mission/i }).getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: /Set duration/i }).getAttribute('aria-expanded')
    ).toBe('false');
    expect(screen.getByRole('button', { name: 'COPY RALLY LINK' })).toBeTruthy();
  });

  it('copies from the collapsed Copy link shortcut without expanding Share mission', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderSteps();
    // Duration starts expanded — collapse it so Share shows the collapsed summary.
    fireEvent.click(screen.getByRole('button', { name: /Set duration/i }));

    const shareHeader = screen.getByRole('button', { name: /Share mission/i });
    const stepRoot = shareHeader.closest('[data-walkthrough-id="rally-link"]');
    expect(stepRoot).toBeTruthy();
    const copyShortcut = within(stepRoot as HTMLElement).getByRole('button', {
      name: 'Copy link',
    });

    await act(async () => {
      fireEvent.click(copyShortcut);
    });

    expect(writeText).toHaveBeenCalledWith(`https://amrap.example/join?m=${MISSION_ID}&card=f`);
    expect(shareHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('copies only the mission ID from the collapsed Share mission shortcut', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderSteps();
    fireEvent.click(screen.getByRole('button', { name: /Set duration/i }));

    const shareHeader = screen.getByRole('button', { name: /Share mission/i });
    const stepRoot = shareHeader.closest('[data-walkthrough-id="rally-link"]');
    expect(stepRoot).toBeTruthy();
    const copyIdShortcut = within(stepRoot as HTMLElement).getByRole('button', {
      name: 'Copy mission ID',
    });

    await act(async () => {
      fireEvent.click(copyIdShortcut);
    });

    expect(writeText).toHaveBeenCalledWith(MISSION_ID);
    expect(shareHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the pacer step when showPacer is true', () => {
    renderSteps({ showPacer: true, templateId: TEMPLATE_ID });
    expect(screen.getByRole('button', { name: /Select pacer/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Select pacer/i }));
    expect(screen.getByTestId('ghost-picker')).toBeTruthy();
  });
});
