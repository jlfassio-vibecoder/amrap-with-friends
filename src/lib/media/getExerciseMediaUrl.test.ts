import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXERCISE_MEDIA_BUCKET, getExerciseMediaUrl } from './getExerciseMediaUrl';

const getPublicUrl = vi.fn();
const from = vi.fn(() => ({ getPublicUrl }));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    storage: { from },
  })),
}));

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
