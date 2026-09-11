import { describe, expect, it } from 'vitest';
import {
  buildReminderEmail,
  formatReminderTime,
  unsubscribeUrl,
  type ReminderEmailInput,
} from '@/lib/rooms/reminderEmail';

const base: ReminderEmailInput = {
  kind: '24h',
  roomHandle: 'ironworks',
  roomDisplayName: 'Ironworks',
  scheduledAt: new Date('2026-09-15T23:00:00Z'),
  roomTimezone: 'America/New_York',
  durationMinutes: 20,
  workoutName: 'The Hull Breach',
  origin: 'https://www.amrapwithfriends.com',
  unsubscribeToken: 'tok-123',
};

describe('formatReminderTime', () => {
  it('renders in the room timezone, not the runner’s', () => {
    const formatted = formatReminderTime(base.scheduledAt, 'America/New_York');
    expect(formatted).toContain('7:00');
    expect(formatted).toContain('Tuesday');
  });

  it('names the zone, so a travelling athlete cannot misread the hour', () => {
    expect(formatReminderTime(base.scheduledAt, 'America/New_York')).toMatch(/EDT|EST|GMT/);
  });

  it('gives a different wall clock for a different room timezone', () => {
    const ny = formatReminderTime(base.scheduledAt, 'America/New_York');
    const la = formatReminderTime(base.scheduledAt, 'America/Los_Angeles');
    expect(ny).not.toEqual(la);
  });
});

describe('buildReminderEmail', () => {
  it('leads the 1h mail with the start, and the 24h mail with the day', () => {
    const soon = buildReminderEmail({ ...base, kind: '1h' });
    const tomorrow = buildReminderEmail(base);

    expect(soon.subject).toBe('Starting in an hour: Ironworks');
    expect(tomorrow.subject).toContain('Coming up with Ironworks');
    expect(soon.text).not.toEqual(tomorrow.text);
  });

  it('never claims a day it cannot know', () => {
    // Anything one to twenty-four hours out is classified `24h`, so the mail
    // reaches people whose mission is later today.
    expect(buildReminderEmail(base).subject).not.toContain('Tomorrow');
  });

  it('links to the room and carries the workout', () => {
    const email = buildReminderEmail(base);
    expect(email.text).toContain('https://www.amrapwithfriends.com/@ironworks');
    expect(email.text).toContain('The Hull Breach · 20 min');
  });

  it('falls back to the duration when the room ran no named workout', () => {
    const email = buildReminderEmail({ ...base, workoutName: undefined });
    expect(email.text).toContain('20 min');
    expect(email.text).not.toContain('·');
  });

  it('always carries an unsubscribe link in both bodies', () => {
    const email = buildReminderEmail(base);
    const expected = unsubscribeUrl(base.origin, 'tok-123');
    expect(email.text).toContain(expected);
    expect(email.html).toContain(expected);
  });

  it('sets the one-click unsubscribe headers mail clients render themselves', () => {
    const email = buildReminderEmail(base);
    expect(email.headers['List-Unsubscribe']).toBe(`<${unsubscribeUrl(base.origin, 'tok-123')}>`);
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('escapes a room name that would otherwise inject markup', () => {
    const email = buildReminderEmail({
      ...base,
      roomDisplayName: '<script>alert(1)</script>',
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('url-encodes the token rather than pasting it raw', () => {
    expect(unsubscribeUrl('https://x.test', 'a b&c')).toBe(
      'https://x.test/api/room-reminders/unsubscribe?t=a%20b%26c'
    );
  });
});
