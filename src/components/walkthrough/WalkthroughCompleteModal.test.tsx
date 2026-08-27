import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WalkthroughCompleteModal } from './WalkthroughCompleteModal';

afterEach(() => {
  cleanup();
});

describe('WalkthroughCompleteModal', () => {
  it('calls onContinue from the primary CTA', () => {
    const onContinue = vi.fn();
    render(
      <WalkthroughCompleteModal
        onContinue={onContinue}
        onNeverShowAgain={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: "Let's do this!" })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Let's do this!" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onNeverShowAgain from the secondary CTA', () => {
    const onNeverShowAgain = vi.fn();
    render(
      <WalkthroughCompleteModal
        onContinue={() => undefined}
        onNeverShowAgain={onNeverShowAgain}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Never show this again' }));
    expect(onNeverShowAgain).toHaveBeenCalledTimes(1);
  });
});
