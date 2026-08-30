import { describe, expect, it } from 'vitest';
import { buildLobbyInviteUrl } from './buildLobbyInviteUrl';

describe('buildLobbyInviteUrl', () => {
  it('builds a join link with lobby and default female card', () => {
    expect(buildLobbyInviteUrl('abc-123', 'https://amrap.example')).toBe(
      'https://amrap.example/join?l=abc-123&card=f'
    );
  });

  it('bakes a male card when requested', () => {
    expect(buildLobbyInviteUrl('abc-123', 'https://amrap.example', 'm')).toBe(
      'https://amrap.example/join?l=abc-123&card=m'
    );
  });
});
