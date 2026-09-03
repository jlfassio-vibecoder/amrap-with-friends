import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('submit-participant-result function contract', () => {
  it('reads missions and mission_id, not the renamed sessions table', () => {
    const index = readFileSync(
      join(root, 'supabase/functions/submit-participant-result/index.ts'),
      'utf8'
    );
    const handler = readFileSync(
      join(root, 'supabase/functions/submit-participant-result/handler.ts'),
      'utf8'
    );

    expect(index).toContain(".from('missions')");
    expect(index).toContain('mission_id');
    expect(index).not.toContain(".from('sessions')");
    expect(index).not.toMatch(/from\('sessions'\)/);
    expect(handler).toContain('missionId');
    expect(handler).toContain('mission_id');
  });
});
