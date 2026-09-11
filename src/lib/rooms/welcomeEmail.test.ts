import { describe, expect, it } from 'vitest';
import { buildWelcomeEmail, welcomeSteps } from '@/lib/rooms/welcomeEmail';

const base = {
  roomHandle: 'coach_justin',
  roomDisplayName: 'AMRAP With Friends',
  isActive: true,
  origin: 'https://www.amrapwithfriends.com',
};

describe('welcomeSteps', () => {
  it('tells an active host to get a mission on the clock', () => {
    const steps = welcomeSteps(true, 'https://x.test/@a');
    expect(steps[0]).toContain('Schedule your first mission');
  });

  it('never tells an inactive host to schedule, because that button fails', () => {
    const steps = welcomeSteps(false, 'https://x.test/@a');
    expect(steps.join(' ')).not.toContain('Schedule your first mission');
  });

  it('names the blocker and who clears it', () => {
    const steps = welcomeSteps(false, 'https://x.test/@a').join(' ');
    expect(steps).toContain('not running missions yet');
    expect(steps).toContain('Reply');
  });

  it('still points an inactive host at something they can do', () => {
    expect(welcomeSteps(false, 'https://x.test/@a').join(' ')).toContain('https://x.test/@a');
  });
});

describe('buildWelcomeEmail', () => {
  it('links the room in both bodies', () => {
    const email = buildWelcomeEmail(base);
    expect(email.text).toContain('https://www.amrapwithfriends.com/@coach_justin');
    expect(email.html).toContain('https://www.amrapwithfriends.com/@coach_justin');
  });

  it('names the room in the subject', () => {
    expect(buildWelcomeEmail(base).subject).toContain('AMRAP With Friends');
  });

  it('sends a different mail to an inactive room', () => {
    const active = buildWelcomeEmail(base);
    const inactive = buildWelcomeEmail({ ...base, isActive: false });
    expect(active.text).not.toEqual(inactive.text);
  });

  it('escapes a room name that would otherwise inject markup', () => {
    const email = buildWelcomeEmail({ ...base, roomDisplayName: '<img src=x>' });
    expect(email.html).not.toContain('<img src=x>');
  });

  it('never calls the room URL a rally link', () => {
    // CLAUDE.md reserves "rally link" for a URL that opens a mission (`?m=`)
    // or the Next Mission hub (`?r=`). This one opens the room page, and the
    // dashboard's own button calls it "Copy link".
    for (const isActive of [true, false]) {
      const email = buildWelcomeEmail({ ...base, isActive });
      expect(email.text.toLowerCase()).not.toContain('rally link');
      expect(email.html.toLowerCase()).not.toContain('rally link');
    }
  });

  it('points at the dashboard', () => {
    expect(buildWelcomeEmail(base).html).toContain('https://www.amrapwithfriends.com/host');
  });
});
