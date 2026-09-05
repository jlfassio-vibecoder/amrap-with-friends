import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseInfoModal } from './ExerciseInfoModal';
import type { ExerciseInfo } from '@/data/exerciseLibrary';

vi.mock('@/lib/media/getExerciseMediaUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media/getExerciseMediaUrl')>();
  return {
    ...actual,
    getExerciseMediaUrl: vi.fn((path: string) =>
      path ? `https://cdn.example/exercise-media/${path}` : ''
    ),
  };
});

afterEach(() => {
  cleanup();
});

const infoWithBrokenPhoto: ExerciseInfo = {
  id: 'test-exercise',
  name: 'Test Exercise',
  primaryPatterns: ['full-body-conditioning'],
  setupAndExecution: ['Do the thing.'],
  commonMistakes: [],
  coachingCue: 'Stay tall.',
  photos: [{ url: 'test-exercise/broken.jpg', caption: 'Setup' }],
};

describe('ExerciseInfoModal media', () => {
  it('tries alternate image extensions before showing the placeholder', () => {
    const info: ExerciseInfo = {
      ...infoWithBrokenPhoto,
      photos: [{ url: 'test-exercise/sequence.jpeg', caption: 'Setup' }],
    };

    render(<ExerciseInfoModal info={info} onClose={() => undefined} />);

    let image = screen.getByRole('img', { name: 'Setup' });
    expect(image.getAttribute('src')).toBe(
      'https://cdn.example/exercise-media/test-exercise/sequence.jpeg'
    );

    fireEvent.error(image);
    image = screen.getByRole('img', { name: 'Setup' });
    expect(image.getAttribute('src')).toBe(
      'https://cdn.example/exercise-media/test-exercise/sequence.png'
    );

    fireEvent.error(image);
    image = screen.getByRole('img', { name: 'Setup' });
    expect(image.getAttribute('src')).toBe(
      'https://cdn.example/exercise-media/test-exercise/sequence.jpg'
    );
  });

  it('falls back to the photo placeholder when all image formats fail to load', () => {
    render(<ExerciseInfoModal info={infoWithBrokenPhoto} onClose={() => undefined} />);

    fireEvent.error(screen.getByRole('img', { name: 'Setup' }));
    fireEvent.error(screen.getByRole('img', { name: 'Setup' }));
    fireEvent.error(screen.getByRole('img', { name: 'Setup' }));

    expect(screen.queryByRole('img', { name: 'Setup' })).toBeNull();
    expect(screen.getByText('Setup')).toBeTruthy();
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [5, 3],
  ] as const)(
    'uses %i photo(s) → %i grid column(s)',
    (photoCount, expectedColumns) => {
      const info: ExerciseInfo = {
        ...infoWithBrokenPhoto,
        photos: Array.from({ length: photoCount }, (_, index) => ({
          url: `test-exercise/${index}.jpg`,
          caption: index === 0 ? 'Setup' : undefined,
        })),
      };

      render(<ExerciseInfoModal info={info} onClose={() => undefined} />);

      const grid = screen.getByTestId('exercise-photo-grid');
      expect(grid.getAttribute('data-columns')).toBe(String(expectedColumns));
      expect(grid.style.gridTemplateColumns).toBe(
        `repeat(${expectedColumns}, minmax(0, 1fr))`
      );
    }
  );

  it('omits figcaption when a photo has no caption', () => {
    const info: ExerciseInfo = {
      ...infoWithBrokenPhoto,
      photos: [{ url: 'test-exercise/nocap.jpg' }],
    };

    render(<ExerciseInfoModal info={info} onClose={() => undefined} />);

    expect(screen.getByRole('img', { name: 'Test Exercise' })).toBeTruthy();
    expect(screen.queryByText('Setup')).toBeNull();
  });
});
