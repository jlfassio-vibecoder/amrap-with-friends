import { describe, expect, it } from 'vitest';
import { buildLobbyInviteUrl } from './buildLobbyInviteUrl';

describe('buildLobbyInviteUrl', () => {
  it('builds a join link with the lobby query param', () => {
    expect(buildLobbyInviteUrl('abc-123', 'https://amrap.example')).toBe(
      'https://amrap.example/join?l=abc-123'
    );
  });
});
