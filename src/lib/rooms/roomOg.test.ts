import { describe, it, expect } from 'vitest';
import {
  roomCanonical,
  roomOgDescription,
  roomOgImage,
  roomOgTitle,
  type RoomSummary,
} from './roomOg';

const ROOM: RoomSummary = {
  handle: 'bay_area_crossfit',
  displayName: 'Bay Area CrossFit',
  intro: null,
  memberCount: 12,
  avatarPath: null,
};

describe('roomOgTitle', () => {
  it('names the room and its handle', () => {
    expect(roomOgTitle(ROOM)).toBe('Bay Area CrossFit · @bay_area_crossfit');
  });

  // A link that fails to resolve still has to unfurl as something.
  it('falls back to a generic title when the room is unknown', () => {
    expect(roomOgTitle(null)).toBe('Train with your coach on AMRAP With Friends');
  });
});

describe('roomOgDescription', () => {
  it('prefers the room’s own intro', () => {
    expect(roomOgDescription({ ...ROOM, intro: '  Strength and conditioning, 6am PT.  ' })).toBe(
      'Strength and conditioning, 6am PT.'
    );
  });

  it('truncates a long intro rather than shipping a wall of text', () => {
    const long = 'x'.repeat(400);
    expect(roomOgDescription({ ...ROOM, intro: long }).length).toBe(200);
  });

  it('counts the others, not the room', () => {
    expect(roomOgDescription({ ...ROOM, memberCount: 12 })).toContain('and 11 others');
  });

  // "and 0 others" is worse than saying nothing about size.
  it('says nothing about size for a room of one', () => {
    const text = roomOgDescription({ ...ROOM, memberCount: 1 });
    expect(text).toBe('Train with Bay Area CrossFit. One synced clock, no app to install.');
    expect(text).not.toContain('others');
  });

  it('has a generic description when the room is unknown', () => {
    expect(roomOgDescription(null)).toContain('One synced clock');
  });
});

describe('roomOgImage', () => {
  it('uses the room avatar when there is one', () => {
    expect(
      roomOgImage({ ...ROOM, avatarPath: 'a/b.png' }, 'https://x.test', 'https://db.test')
    ).toBe('https://db.test/storage/v1/object/public/room-media/a/b.png');
  });

  // Rooms have no generated card yet; pointing at one would 404 in every chat.
  it('falls back to the site card, never a room path that does not exist', () => {
    expect(roomOgImage(ROOM, 'https://x.test', 'https://db.test')).toBe(
      'https://x.test/og-image-f.png'
    );
    expect(roomOgImage({ ...ROOM, avatarPath: 'a/b.png' }, 'https://x.test', null)).toBe(
      'https://x.test/og-image-f.png'
    );
  });
});

describe('roomCanonical', () => {
  it('lower-cases the handle, whatever was typed', () => {
    expect(roomCanonical('https://x.test', 'Bay_Area_CrossFit')).toBe(
      'https://x.test/@bay_area_crossfit'
    );
  });
});
