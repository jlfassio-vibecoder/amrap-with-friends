import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuidedIgnitionOverlay } from './GuidedIgnitionOverlay';

afterEach(() => {
  cleanup();
});

describe('GuidedIgnitionOverlay', () => {
  it('renders all three tier cards', () => {
    render(<GuidedIgnitionOverlay onSelect={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByText(/TIER 1/)).toBeTruthy();
    expect(screen.getByText(/TIER 2/)).toBeTruthy();
    expect(screen.getByText(/TIER 3/)).toBeTruthy();
  });

  it('calls onSelect with first-contact when Tier 1 CTA is clicked', () => {
    const onSelect = vi.fn();
    render(<GuidedIgnitionOverlay onSelect={onSelect} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set my baseline' }));

    expect(onSelect).toHaveBeenCalledWith('first-contact');
  });

  it('calls onSelect with steady-altitude when Tier 2 CTA is clicked', () => {
    const onSelect = vi.fn();
    render(<GuidedIgnitionOverlay onSelect={onSelect} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Give me a target' }));

    expect(onSelect).toHaveBeenCalledWith('steady-altitude');
  });

  it('calls onSelect with the-undertow when Tier 3 CTA is clicked', () => {
    const onSelect = vi.fn();
    render(<GuidedIgnitionOverlay onSelect={onSelect} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Put me in the Crucible' }));

    expect(onSelect).toHaveBeenCalledWith('the-undertow');
  });

  it('calls onSkip when the skip link is clicked', () => {
    const onSkip = vi.fn();
    render(<GuidedIgnitionOverlay onSelect={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: /Skip and browse/ }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('renders the dialog with correct accessible role', () => {
    render(<GuidedIgnitionOverlay onSelect={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
