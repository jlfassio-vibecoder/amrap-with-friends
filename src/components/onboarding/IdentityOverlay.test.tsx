import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IdentityOverlay } from './IdentityOverlay';

afterEach(() => {
  cleanup();
});

const suggestion = { username: 'Ghost_Actual', nickname: 'Ghost-Actual' };

describe('IdentityOverlay', () => {
  it('keeps Accept disabled until the suggestion settles', async () => {
    render(
      <IdentityOverlay
        onClose={() => {}}
        onAccept={vi.fn().mockResolvedValue({ error: null })}
        suggestIdentity={() => suggestion}
        scrambleSteps={8}
        scrambleIntervalMs={20}
      />
    );

    expect(screen.getByRole('button', { name: 'Accept & Launch' })).toHaveProperty(
      'disabled',
      true
    );
    await waitFor(() => {
      expect(screen.getByText('Ghost-Actual')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Accept & Launch' })).toHaveProperty(
        'disabled',
        false
      );
    });
  });

  it('regenerates a new suggestion', async () => {
    let n = 0;
    render(
      <IdentityOverlay
        onClose={() => {}}
        onAccept={vi.fn().mockResolvedValue({ error: null })}
        suggestIdentity={() => {
          n += 1;
          return n === 1 ? suggestion : { username: 'Viper_2', nickname: 'Viper-2' };
        }}
        scrambleSteps={1}
        scrambleIntervalMs={0}
      />
    );

    await waitFor(() => expect(screen.getByText('Ghost-Actual')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Suggest another' }));
    await waitFor(() => expect(screen.getByText('Viper-2')).toBeTruthy());
  });

  it('lets the athlete type their own name', async () => {
    const onAccept = vi.fn().mockResolvedValue({ error: null });
    render(
      <IdentityOverlay
        onClose={() => {}}
        onAccept={onAccept}
        suggestIdentity={() => suggestion}
        scrambleSteps={1}
        scrambleIntervalMs={0}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'I want to type my own' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Maya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept & Launch' }));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith({ username: 'Maya', nickname: 'Maya' });
    });
  });

  it('closes on Escape when dismissible', () => {
    const onClose = vi.fn();
    render(
      <IdentityOverlay
        onClose={onClose}
        onAccept={vi.fn()}
        suggestIdentity={() => suggestion}
        scrambleSteps={1}
        scrambleIntervalMs={0}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('retries a generated name when the username is taken', async () => {
    const onAccept = vi
      .fn()
      .mockResolvedValueOnce({ error: 'That username is already taken.' })
      .mockResolvedValueOnce({ error: null });
    let n = 0;
    render(
      <IdentityOverlay
        onClose={() => {}}
        onAccept={onAccept}
        suggestIdentity={() => {
          n += 1;
          return n === 1 ? suggestion : { username: 'Viper_2', nickname: 'Viper-2' };
        }}
        scrambleSteps={1}
        scrambleIntervalMs={0}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accept & Launch' })).toHaveProperty(
        'disabled',
        false
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept & Launch' }));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledTimes(2);
    });
    expect(onAccept).toHaveBeenLastCalledWith({ username: 'Viper_2', nickname: 'Viper-2' });
  });

  it('shows an error when a typed name is taken', async () => {
    const onAccept = vi.fn().mockResolvedValue({ error: 'That username is already taken.' });
    render(
      <IdentityOverlay
        onClose={() => {}}
        onAccept={onAccept}
        suggestIdentity={() => suggestion}
        scrambleSteps={1}
        scrambleIntervalMs={0}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'I want to type my own' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Maya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept & Launch' }));

    expect(await screen.findByText('That username is already taken.')).toBeTruthy();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
