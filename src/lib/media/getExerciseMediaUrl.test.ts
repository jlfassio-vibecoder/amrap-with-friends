import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXERCISE_MEDIA_BUCKET,
  getExerciseImagePathCandidates,
  getExerciseMediaUrl,
} from './getExerciseMediaUrl';

const getPublicUrl = vi.fn();
const from = vi.fn(() => ({ getPublicUrl }));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    storage: { from },
  })),
}));

describe('getExerciseImagePathCandidates', () => {
  it('returns an empty list for blank paths', () => {
    expect(getExerciseImagePathCandidates('')).toEqual([]);
    expect(getExerciseImagePathCandidates('   ')).toEqual([]);
  });

  it('keeps non-image paths unchanged', () => {
    expect(getExerciseImagePathCandidates('burpees/video.mp4')).toEqual([
      'burpees/video.mp4',
    ]);
  });

  it('tries jpeg then png then jpg when the library path is .jpeg', () => {
    expect(getExerciseImagePathCandidates('burpees/sequence.jpeg')).toEqual([
      'burpees/sequence.jpeg',
      'burpees/sequence.png',
      'burpees/sequence.jpg',
    ]);
  });

  it('tries png then jpeg then jpg when the stored path is .png', () => {
    expect(getExerciseImagePathCandidates('burpees/sequence.png')).toEqual([
      'burpees/sequence.png',
      'burpees/sequence.jpeg',
      'burpees/sequence.jpg',
    ]);
  });
});

describe('getExerciseMediaUrl', () => {
  beforeEach(() => {
    getPublicUrl.mockReset();
    from.mockClear();
    getPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://example.supabase.co/storage/v1/object/public/exercise-media/burpees/1-setup.jpg',
      },
    });
  });

  it('returns an empty string for blank paths without calling Storage', () => {
    expect(getExerciseMediaUrl('')).toBe('');
    expect(getExerciseMediaUrl('   ')).toBe('');
    expect(from).not.toHaveBeenCalled();
  });

  it('resolves a relative path via the exercise-media bucket', () => {
    const url = getExerciseMediaUrl('burpees/1-setup.jpg');

    expect(from).toHaveBeenCalledWith(EXERCISE_MEDIA_BUCKET);
    expect(getPublicUrl).toHaveBeenCalledWith('burpees/1-setup.jpg');
    expect(url).toBe(
      'https://example.supabase.co/storage/v1/object/public/exercise-media/burpees/1-setup.jpg'
    );
  });
});
