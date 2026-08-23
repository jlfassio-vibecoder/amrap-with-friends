import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseInfoModal } from './ExerciseInfoModal';
import type { ExerciseInfo } from '@/data/exerciseLibrary';

vi.mock('@/lib/media/getExerciseMediaUrl', () => ({
  getExerciseMediaUrl: vi.fn((path: string) =>
    path ? `https://cdn.example/exercise-media/${path}` : ''
  ),
}));

afterEach(() => {
  cleanup();
});

const infoWithBrokenPhoto: ExerciseInfo = {
  id: 'test-exercise',
  name: 'Test Exercise',
  setupAndExecution: ['Do the thing.'],
  commonMistakes: [],
  coachingCue: 'Stay tall.',
  photos: [{ url: 'test-exercise/broken.jpg', caption: 'Setup' }],
};

describe('ExerciseInfoModal media', () => {
  it('falls back to the photo placeholder when an image fails to load', () => {
    render(<ExerciseInfoModal info={infoWithBrokenPhoto} onClose={() => undefined} />);

    const image = screen.getByRole('img', { name: 'Setup' });
    fireEvent.error(image);

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
