import { describe, expect, it, vi } from 'vitest';
import { drawFrame, type Ctx } from '@/lib/share/renderer/drawFrame';
import { frameAt } from '@/lib/share/timeline';
import type { ReplayData } from '@/lib/share/types';

/**
 * jsdom has no canvas, so this records the calls instead. That is the right
 * level anyway: the value here is that the renderer draws the correct *text*,
 * stays inside the safe area, and never reaches for the DOM.
 */
function recordingCtx(): {
  ctx: Ctx;
  texts: { text: string; x: number; y: number }[];
  rects: number[][];
} {
  const texts: { text: string; x: number; y: number }[] = [];
  const rects: number[][] = [];
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: (...args: number[]) => rects.push(args),
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
    measureText: (text: string) => ({ width: text.length * 18 }),
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as Ctx;
  return { ctx, texts, rects };
}

function data(participants: number, meRounds = 7): ReplayData {
  return {
    mission: {
      id: 'm1',
      templateId: 'blood-shunt',
      workout: null,
      capSeconds: 720,
      durationMinutes: 12,
      intensityTier: 3,
      state: 'finished',
      startedAt: null,
      segmentIndex: 0,
    },
    participants: Array.from({ length: participants }, (_, index) => ({
      participantId: `p${index}`,
      userId: null,
      displayName: index === 0 ? 'Me' : `Athlete ${index}`,
      isMe: index === 0,
      finalRounds: index === 0 ? meRounds : 3,
      finalReps: index === 0 ? 12 : 0,
      role: index === 0 ? 'host' : 'joiner',
    })),
    rounds: [],
  };
}

const baseOptions = {
  layout: 'story' as const,
  variant: 'result' as const,
  title: 'The Hull Breach',
  subtitle: '12 min AMRAP · 9 Sep',
  shareUrl: 'amrapwithfriends.com/s/abc12345',
  watermark: true,
};

describe('drawFrame', () => {
  it('draws the score, the name and the link', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(3)), baseOptions);
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('7 rounds + 12');
    expect(all).toContain('Me');
    expect(all).toContain('amrapwithfriends.com/s/abc12345');
    expect(all).toContain('The Hull Breach');
  });

  it('keeps everything inside the story safe area', () => {
    // Instagram covers the top 250px and bottom 300px of a Story with its own
    // UI; anything drawn there is invisible to the viewer.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(6)), baseOptions);
    for (const entry of texts) {
      expect(entry.y).toBeGreaterThanOrEqual(250);
      expect(entry.y).toBeLessThanOrEqual(1920 - 300 + 80);
    }
  });

  it('omits the leaderboard for an amqap card', () => {
    // A quality flow has no score to rank; a board would misrepresent it.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(4)), { ...baseOptions, variant: 'amqap' });
    expect(texts.map((entry) => entry.text)).not.toContain('Athlete 1');
  });

  it('drops the hero score on the squad card but keeps the board', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(4)), { ...baseOptions, variant: 'squad' });
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('Athlete 1');
    expect(all.filter((text) => text === '7 rounds + 12')).toHaveLength(1); // board row only
  });

  it('omits the watermark when told to', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(2)), { ...baseOptions, watermark: false });
    expect(texts.map((entry) => entry.text)).not.toContain('AMRAP With Friends');
  });

  it('truncates a name rather than letting it run off the card', () => {
    const wide = data(2);
    wide.participants[0]!.displayName = 'A'.repeat(200);
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(wide), baseOptions);
    expect(texts.some((entry) => entry.text.endsWith('…'))).toBe(true);
  });
});
