import { describe, it, expect } from 'vitest';
import { roomActivitySentence, roomInviteLabel, roomInviteUrl } from './roomInvite';

describe('roomInviteUrl', () => {
  it('is the room address, lower-cased', () => {
    expect(roomInviteUrl('https://amrapwithfriends.com', 'Bay_Area_CrossFit')).toBe(
      'https://amrapwithfriends.com/@bay_area_crossfit'
    );
    expect(roomInviteLabel('Bay_Area_CrossFit')).toBe('@bay_area_crossfit');
  });
});

describe('roomActivitySentence', () => {
  const none = {
    finishedThisWeek: 0,
    athletesThisWeek: 0,
    missionsThisWeek: 0,
    returningAthletes: 0,
  };

  it('says so when nothing has run', () => {
    expect(roomActivitySentence(none)).toBe('No missions this week yet.');
  });

  it('distinguishes a mission with no finishes from no mission at all', () => {
    expect(roomActivitySentence({ ...none, missionsThisWeek: 1 })).toBe(
      'No finishes yet this week.'
    );
  });

  it('counts finishes and athletes', () => {
    expect(
      roomActivitySentence({
        finishedThisWeek: 8,
        athletesThisWeek: 6,
        missionsThisWeek: 1,
        returningAthletes: 3,
      })
    ).toBe('8 finishes this week from 6 athletes. 3 have trained with you more than once.');
  });

  // The number the pilot turns on. Saying nothing would read as zero anyway,
  // so it is better said plainly.
  it('says nobody came back rather than going quiet', () => {
    expect(
      roomActivitySentence({
        finishedThisWeek: 4,
        athletesThisWeek: 4,
        missionsThisWeek: 1,
        returningAthletes: 0,
      })
    ).toContain('Nobody has come back for a second one yet.');
  });

  it('gets the singulars right', () => {
    const text = roomActivitySentence({
      finishedThisWeek: 1,
      athletesThisWeek: 1,
      missionsThisWeek: 1,
      returningAthletes: 1,
    });
    expect(text).toBe('1 finish this week from 1 athlete. 1 has trained with you more than once.');
  });
});
