import { describe, it, expect } from 'vitest';
import { joinNote, postFinishSheet, POST_FINISH_ORDER } from './postFinish';

const ROOM = {
  handle: 'bay_area_crossfit',
  displayName: 'Bay Area CrossFit',
  isMember: false,
  hasHomeCoach: false,
};

describe('postFinishSheet', () => {
  it('offers save and join together for a guest in a room', () => {
    const sheet = postFinishSheet({ room: ROOM, canSave: true });
    expect(sheet).toMatchObject({ show: true, showSave: true, showJoin: true, joinDefault: true });
    expect(sheet.joinNote).toContain('Bay Area CrossFit');
  });

  // The plan is explicit: the box starts ticked.
  it('starts the checkbox ticked', () => {
    expect(postFinishSheet({ room: ROOM, canSave: true }).joinDefault).toBe(true);
  });

  it('does not re-offer a room the athlete is already in', () => {
    const sheet = postFinishSheet({ room: { ...ROOM, isMember: true }, canSave: true });
    expect(sheet.showJoin).toBe(false);
    expect(sheet.joinNote).toBeNull();
    expect(sheet.showSave).toBe(true);
  });

  // A personal mission is most missions; the sheet must not appear for them.
  it('shows nothing for a personal mission with nothing left to save', () => {
    expect(postFinishSheet({ room: null, canSave: false }).show).toBe(false);
  });

  it('still offers save for a personal mission', () => {
    const sheet = postFinishSheet({ room: null, canSave: true });
    expect(sheet).toMatchObject({ show: true, showSave: true, showJoin: false });
  });

  // Saved already, but never joined: the room is still worth offering.
  it('offers join alone once the result is saved', () => {
    const sheet = postFinishSheet({ room: ROOM, canSave: false });
    expect(sheet).toMatchObject({ show: true, showSave: false, showJoin: true });
  });
});

describe('joinNote', () => {
  it('says what the coach can see', () => {
    expect(joinNote('Bay Area CrossFit', false)).toContain(
      'will see the missions you finish in their room'
    );
  });

  it('promises the squad is untouched', () => {
    expect(joinNote('Bay Area CrossFit', false)).toContain("never adds you to anyone's squad");
  });

  // Said before they decide, not after they have joined.
  it('tells an athlete who already has a home coach that it does not move', () => {
    expect(joinNote('Bay Area CrossFit', true)).toContain('home coach stays who it is today');
  });
});

describe('POST_FINISH_ORDER', () => {
  it('puts share first, because it is the thing they actually want', () => {
    expect(POST_FINISH_ORDER).toEqual(['share', 'save', 'join']);
  });
});
