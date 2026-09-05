import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCoachArticleMediaUrl, uploadCoachArticlePhoto } from './coachArticleMedia';

const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
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
  getSessionMock.mockReset();
  getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://example.test/public/path.jpg' } });
  getSessionMock.mockResolvedValue({
    data: { session: { user: { id: 'coach-1' } } },
    error: null,
  });
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('getCoachArticleMediaUrl', () => {
  it('returns empty string for an empty path', () => {
    expect(getCoachArticleMediaUrl('  ')).toBe('');
  });

  it('resolves a public url for a relative path', () => {
    expect(getCoachArticleMediaUrl('coach-id/article-id/photo-id.jpg')).toBe(
      'https://example.test/public/path.jpg'
    );
  });
});

describe('uploadCoachArticlePhoto', () => {
  it('rejects an unsupported mime type', async () => {
    const file = makeFile('clip.gif', 'image/gif', 1024);
    const result = await uploadCoachArticlePhoto('coach-1', 'art-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('JPEG, PNG, or WebP');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit', async () => {
    const file = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
    const result = await uploadCoachArticlePhoto('coach-1', 'art-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('5MB');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('uploads a valid image on the article-scoped path', async () => {
    uploadMock.mockResolvedValue({ error: null });
    const file = makeFile('photo.jpeg', 'image/jpeg', 1024);

    const result = await uploadCoachArticlePhoto('coach-1', 'art-1', 'photo-1', file);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path, body, options] = uploadMock.mock.calls[0];
    expect(path).toBe('coach-1/art-1/photo-1.jpeg');
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(options).toMatchObject({
      upsert: false,
      contentType: 'image/jpeg',
    });
    expect(result.error).toBeNull();
    expect(result.path).toBe('coach-1/art-1/photo-1.jpeg');
  });

  it('rejects when there is no auth session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const file = makeFile('photo.jpeg', 'image/jpeg', 1024);

    const result = await uploadCoachArticlePhoto('coach-1', 'art-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('Sign in');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('surfaces a storage upload failure', async () => {
    uploadMock.mockResolvedValue({
      error: { message: 'new row violates row-level security policy' },
    });
    const file = makeFile('photo.jpeg', 'image/jpeg', 1024);

    const result = await uploadCoachArticlePhoto('coach-1', 'art-1', 'photo-1', file);

    expect(result.path).toBeNull();
    expect(result.error).toContain('blocked');
  });
});
