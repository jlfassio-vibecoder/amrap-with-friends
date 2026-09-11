import { describe, expect, it } from 'vitest';
import { createReminderToken, verifyReminderToken } from '@/lib/rooms/reminderToken';

const SECRET = 'test-secret-value';
const payload = {
  userId: '11111111-1111-4111-8111-111111111111',
  roomId: '22222222-2222-4222-8222-222222222222',
};

describe('reminder unsubscribe token', () => {
  it('round-trips the membership it identifies', async () => {
    const token = await createReminderToken(payload, SECRET);
    expect(await verifyReminderToken(token, SECRET)).toEqual(payload);
  });

  it('is url-safe, so it survives being pasted into a mail client', async () => {
    const token = await createReminderToken(payload, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createReminderToken(payload, 'other-secret');
    expect(await verifyReminderToken(token, SECRET)).toBeNull();
  });

  it('rejects a tampered payload — the ids are public, the tag is not', async () => {
    const token = await createReminderToken(payload, SECRET);
    const [, tag] = token.split('.');
    const forged = await createReminderToken(
      { userId: payload.userId, roomId: '33333333-3333-4333-8333-333333333333' },
      'guessed'
    );
    const swapped = `${forged.split('.')[0]}.${tag}`;
    expect(await verifyReminderToken(swapped, SECRET)).toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    for (const bad of ['', 'no-dot', 'a.b.c', '....', '!!!.???']) {
      expect(await verifyReminderToken(bad, SECRET)).toBeNull();
    }
  });

  it('gives different tokens for different members of the same room', async () => {
    const a = await createReminderToken(payload, SECRET);
    const b = await createReminderToken(
      { ...payload, userId: '44444444-4444-4444-8444-444444444444' },
      SECRET
    );
    expect(a).not.toEqual(b);
  });

  it('is stable, so a link kept for a year still works', async () => {
    const first = await createReminderToken(payload, SECRET);
    const second = await createReminderToken(payload, SECRET);
    expect(first).toEqual(second);
  });
});
