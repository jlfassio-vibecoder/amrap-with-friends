import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCoachExerciseMediaUrl, uploadCoachExercisePhoto } from './coachExerciseMedia';

const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  }),
}));

beforeEach(() => {
  uploadMock.mockReset();
  getPublicUrlMock.mockReset();
  getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://example.test/public/path.jpg' } });
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('getCoachExerciseMediaUrl', () => {
  it('returns empty string for an empty path', () => {
    expect(getCoachExerciseMediaUrl('  ')).toBe('');
  });

  it('resolves a public url for a relative path', () => {
    expect(getCoachExerciseMediaUrl('coach-id/exercise-id/photo-id.jpg')).toBe(
      'https://example.test/public/path.jpg'
    );
  });
});

describe('uploadCoachExercisePhoto', () => {
  it('rejects an unsupported mime type', async () => {
    const file = makeFile('clip.gif', 'image/gif', 1024);
    const result = await uploadCoachExercisePhoto('coach-1', 'ex-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('JPEG, PNG, or WebP');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit', async () => {
    const file = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
    const result = await uploadCoachExercisePhoto('coach-1', 'ex-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('5MB');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('uploads a valid image and returns the owner/exercise/photo-scoped path', async () => {
    uploadMock.mockResolvedValue({ error: null });
    const file = makeFile('photo.jpeg', 'image/jpeg', 1024);

    const result = await uploadCoachExercisePhoto('coach-1', 'ex-1', 'photo-1', file);

    expect(uploadMock).toHaveBeenCalledWith('coach-1/ex-1/photo-1.jpeg', file, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    expect(result.error).toBeNull();
    expect(result.path).toBe('coach-1/ex-1/photo-1.jpeg');
  });

  it('surfaces a storage upload failure', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'boom' } });
    const file = makeFile('photo.jpeg', 'image/jpeg', 1024);

    const result = await uploadCoachExercisePhoto('coach-1', 'ex-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('failed');
  });
});
