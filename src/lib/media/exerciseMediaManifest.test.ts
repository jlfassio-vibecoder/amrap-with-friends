import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildMediaAlt,
  buildPublicMediaUrl,
  resolveExerciseMedia,
} from '@/lib/media/exerciseMediaManifest';
import { EXERCISE_MEDIA_MANIFEST } from '@/data/exerciseMediaManifest';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';

const BASE = 'https://project.supabase.co';

describe('buildPublicMediaUrl', () => {
  it('builds the documented public object URL', () => {
    expect(buildPublicMediaUrl(BASE, 'burpees/sequence.jpeg')).toBe(
      `${BASE}/storage/v1/object/public/exercise-media/burpees/sequence.jpeg`
    );
  });

  it('tolerates a trailing slash on the base and a leading slash on the path', () => {
    expect(buildPublicMediaUrl(`${BASE}/`, '/burpees/sequence.jpeg')).toBe(
      `${BASE}/storage/v1/object/public/exercise-media/burpees/sequence.jpeg`
    );
  });

  it('returns nothing rather than a malformed URL when either half is missing', () => {
    expect(buildPublicMediaUrl('', 'burpees/sequence.jpeg')).toBe('');
    expect(buildPublicMediaUrl(BASE, '   ')).toBe('');
  });
});

describe('resolveExerciseMedia', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for an exercise with no object in the bucket', () => {
    expect(resolveExerciseMedia('not-a-real-exercise', BASE)).toBeNull();
  });

  it('renders no image rather than a broken one when the build has no Supabase URL', () => {
    const [id] = Object.keys(EXERCISE_MEDIA_MANIFEST);
    if (!id) {
      // Manifest not yet generated; the guard is still what we are asserting.
      expect(resolveExerciseMedia('burpees', undefined)).toBeNull();
      return;
    }
    expect(resolveExerciseMedia(id, undefined)).toBeNull();
    expect(resolveExerciseMedia(id, '  ')).toBeNull();
  });

  it('resolves a manifest entry to a full src with its dimensions', () => {
    const [id, entry] = Object.entries(EXERCISE_MEDIA_MANIFEST)[0] ?? [];
    if (!id || !entry) {
      return;
    }
    const resolved = resolveExerciseMedia(id, BASE);
    expect(resolved?.src).toBe(buildPublicMediaUrl(BASE, entry.path));
    expect(resolved?.width).toBe(entry.width);
    expect(resolved?.height).toBe(entry.height);
  });
});

describe('buildMediaAlt', () => {
  it('folds a caption into a sentence after the movement name', () => {
    expect(buildMediaAlt('Burpees', 'The sequence from squat to full extension')).toBe(
      'Burpees: the sequence from squat to full extension'
    );
  });

  it('leaves a caption starting with an acronym alone', () => {
    expect(buildMediaAlt('Sit-ups', 'AB position at the top')).toBe(
      'Sit-ups: AB position at the top'
    );
  });

  it('falls back to a descriptive alt rather than the bare name', () => {
    expect(buildMediaAlt('Air Squats')).toBe('How to do Air Squats');
    expect(buildMediaAlt('Air Squats', '   ')).toBe('How to do Air Squats');
  });

  it('never produces empty alt text for any exercise in the library', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      const alt = buildMediaAlt(exercise.name, exercise.photos[0]?.caption);
      expect(alt.trim(), exercise.id).not.toBe('');
      expect(alt, exercise.id).toContain(exercise.name);
    }
  });
});

describe('EXERCISE_MEDIA_MANIFEST', () => {
  it('only names exercises that exist in the library', () => {
    const ids = new Set(EXERCISE_LIBRARY.map((exercise) => exercise.id));
    for (const id of Object.keys(EXERCISE_MEDIA_MANIFEST)) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('gives every entry usable dimensions and alt text', () => {
    for (const [id, entry] of Object.entries(EXERCISE_MEDIA_MANIFEST)) {
      expect(entry.path.trim(), id).not.toBe('');
      expect(entry.width, id).toBeGreaterThan(0);
      expect(entry.height, id).toBeGreaterThan(0);
      expect(entry.alt.trim(), id).not.toBe('');
    }
  });
});
