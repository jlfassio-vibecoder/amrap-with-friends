import { describe, expect, it } from 'vitest';
import { getPhotoGridColumnCount } from './getPhotoGridColumnCount';

describe('getPhotoGridColumnCount', () => {
  it('maps photo counts to column counts', () => {
    expect(getPhotoGridColumnCount(0)).toBe(0);
    expect(getPhotoGridColumnCount(1)).toBe(1);
    expect(getPhotoGridColumnCount(2)).toBe(2);
    expect(getPhotoGridColumnCount(3)).toBe(3);
    expect(getPhotoGridColumnCount(4)).toBe(3);
    expect(getPhotoGridColumnCount(5)).toBe(3);
    expect(getPhotoGridColumnCount(6)).toBe(3);
  });
});
