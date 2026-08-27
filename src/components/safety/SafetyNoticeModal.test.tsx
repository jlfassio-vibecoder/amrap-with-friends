import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SafetyNoticeModal } from './SafetyNoticeModal';

afterEach(() => {
  cleanup();
});

describe('SafetyNoticeModal', () => {
  it('renders title and body', () => {
    render(
      <SafetyNoticeModal
        title="Warm up first"
        body="Do a proper warm-up before you start."
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Warm up first' })).toBeTruthy();
    expect(
      screen.getByText('Do a proper warm-up before you start.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I understand' })).toBeTruthy();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <SafetyNoticeModal
        title="Warm up first"
        body="Body copy"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when the backdrop is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <SafetyNoticeModal
        title="Warm up first"
        body="Body copy"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('safety-notice-modal'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Warm up first' })).toBeTruthy();
  });

  it('uses a custom confirm label when provided', () => {
    render(
      <SafetyNoticeModal
        title="Title"
        body="Body"
        confirmLabel="Got it"
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
  });
});
