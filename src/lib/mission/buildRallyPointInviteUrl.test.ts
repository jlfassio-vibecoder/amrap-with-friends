import { describe, expect, it } from 'vitest';
import { buildRallyPointInviteUrl } from './buildRallyPointInviteUrl';

describe('buildRallyPointInviteUrl', () => {
  it('builds a join link with rallyPoint and default female card', () => {
    expect(buildRallyPointInviteUrl('abc-123', 'https://amrap.example')).toBe(
      'https://amrap.example/join?r=abc-123&card=f'
    );
  });

  it('bakes a male card when requested', () => {
    expect(buildRallyPointInviteUrl('abc-123', 'https://amrap.example', 'm')).toBe(
      'https://amrap.example/join?r=abc-123&card=m'
    );
  });
});
