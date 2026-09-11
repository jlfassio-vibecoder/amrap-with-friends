import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  finishLine,
  isRoomReaction,
  nextReaction,
  REACTION_LABELS,
  ROOM_REACTIONS,
} from './reactions';

const MIGRATION = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260912300000_room_reactions.sql'
);

/** The reactions the database will actually accept, read out of its CHECK. */
function sqlReactions(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const check = /CHECK \(reaction IN \(([^)]+)\)\)/.exec(sql);
  if (!check) {
    throw new Error('could not find the reaction CHECK constraint');
  }
  return [...check[1]!.matchAll(/'([a-z]+)'/g)].map((match) => match[1]!);
}

describe('the reaction set matches the database', () => {
  /**
   * A label added here alone is refused at the door with no clue why; one
   * added in SQL alone is unreachable. Same drift this repo has been bitten by
   * with reserved handles.
   */
  it('is the same four in both places', () => {
    expect([...ROOM_REACTIONS].sort()).toEqual(sqlReactions().sort());
  });

  it('gives every reaction a label', () => {
    for (const reaction of ROOM_REACTIONS) {
      expect(REACTION_LABELS[reaction]?.length).toBeGreaterThan(0);
    }
  });

  it('is small, because the plan says a small fixed set', () => {
    expect(ROOM_REACTIONS.length).toBeLessThanOrEqual(6);
  });
});

describe('isRoomReaction', () => {
  it('accepts the set and nothing else', () => {
    expect(isRoomReaction('respect')).toBe(true);
    expect(isRoomReaction('nope')).toBe(false);
    expect(isRoomReaction('')).toBe(false);
  });
});

describe('nextReaction', () => {
  it('sets one when there is none', () => {
    expect(nextReaction(null, 'fire')).toBe('fire');
  });

  // Tapping the one you already left is how you take it back.
  it('clears when the same one is tapped again', () => {
    expect(nextReaction('fire', 'fire')).toBeNull();
  });

  it('replaces rather than adds, because there is only one per person', () => {
    expect(nextReaction('fire', 'grit')).toBe('grit');
  });
});

describe('finishLine', () => {
  it('names the athlete and the score', () => {
    expect(finishLine('Maya', 140, false)).toBe('Maya — 140 reps');
  });

  it('marks a guest, because that is who the room is trying to convert', () => {
    expect(finishLine('Maya', 140, true)).toBe('Maya — 140 reps · guest');
  });

  it('survives a blank nickname rather than rendering an empty row', () => {
    expect(finishLine('   ', 100, false)).toBe('Athlete — 100 reps');
  });

  it('omits the score when there is not one', () => {
    expect(finishLine('Maya', null, false)).toBe('Maya');
  });
});
