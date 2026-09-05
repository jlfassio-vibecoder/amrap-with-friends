import { describe, expect, it } from 'vitest';
import { articlePillarPaths, isArticlePillarPath } from './pillarPaths';

describe('articlePillarPaths', () => {
  it('includes core evergreen paths and /create', () => {
    const paths = articlePillarPaths();
    expect(paths).toContain('/guides');
    expect(paths).toContain('/amrap-workouts');
    expect(paths).toContain('/exercises');
    expect(paths).toContain('/create');
  });

  it('is sorted and unique', () => {
    const paths = articlePillarPaths();
    expect(paths).toEqual([...new Set(paths)].sort());
  });
});

describe('isArticlePillarPath', () => {
  it('accepts allowlisted paths only', () => {
    expect(isArticlePillarPath('/guides')).toBe(true);
    expect(isArticlePillarPath('/blog/foo')).toBe(false);
  });
});
