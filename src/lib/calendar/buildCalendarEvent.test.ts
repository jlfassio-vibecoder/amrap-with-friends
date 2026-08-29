import { describe, expect, it } from 'vitest';
import { buildGoogleCalendarUrl, buildIcsFileContent } from './buildCalendarEvent';

const BASE_INPUT = {
  uid: 'session-123',
  title: 'The Undertow',
  description: 'Core rotational endurance. Join: https://example.com/join?s=session-123',
  startsAt: new Date('2026-08-29T16:00:00.000Z'),
  durationMinutes: 15,
};

describe('buildIcsFileContent', () => {
  it('encodes start/end as UTC basic-format timestamps', () => {
    const ics = buildIcsFileContent(BASE_INPUT);

    expect(ics).toContain('DTSTART:20260829T160000Z');
    expect(ics).toContain('DTEND:20260829T161500Z');
  });

  it('includes a UID derived from the input, DTSTAMP, and required VCALENDAR/VEVENT wrapper', () => {
    const ics = buildIcsFileContent(BASE_INPUT);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toMatch(/UID:session-123@amrapwithfriends/);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('produces the same UID for the same input, so re-saving does not duplicate', () => {
    const first = buildIcsFileContent(BASE_INPUT);
    const second = buildIcsFileContent(BASE_INPUT);

    const extractUid = (ics: string) => ics.match(/UID:([^\r\n]+)/)?.[1];
    expect(extractUid(first)).toBe(extractUid(second));
  });

  it('escapes commas, semicolons, backslashes, and newlines per RFC 5545', () => {
    const ics = buildIcsFileContent({
      ...BASE_INPUT,
      title: 'Squats, Burpees; Sprints\\Repeat',
      description: 'Line one\nLine two',
    });

    expect(ics).toContain('SUMMARY:Squats\\, Burpees\\; Sprints\\\\Repeat');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');
  });

  it('folds lines longer than 75 octets with a CRLF + single-space continuation', () => {
    const longDescription = 'x'.repeat(120);
    const ics = buildIcsFileContent({ ...BASE_INPUT, description: longDescription });

    const rawLine = `DESCRIPTION:${longDescription}`;
    expect(ics).not.toContain(rawLine);
    expect(ics).toContain(`DESCRIPTION:${'x'.repeat(75 - 'DESCRIPTION:'.length)}\r\n x`);
  });

  it('uses CRLF line endings throughout', () => {
    const ics = buildIcsFileContent(BASE_INPUT);
    expect(ics.includes('\r\n')).toBe(true);
    // No bare LF without a preceding CR.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('builds a calendar.google.com render URL with the pre-filled event', () => {
    const url = buildGoogleCalendarUrl(BASE_INPUT);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('The Undertow');
    expect(parsed.searchParams.get('dates')).toBe('20260829T160000Z/20260829T161500Z');
    expect(parsed.searchParams.get('details')).toBe(BASE_INPUT.description);
  });
});
