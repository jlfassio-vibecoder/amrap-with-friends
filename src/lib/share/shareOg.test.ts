import { describe, expect, it } from 'vitest';
import {
  shareOgDescription,
  shareOgImage,
  shareOgImageSize,
  shareOgTitle,
} from '@/lib/share/shareOg';

const summary = {
  shareId: 'abc12345',
  imagePath: 'abc12345.png',
  templateId: 'blood-shunt',
  durationMinutes: 12,
  rounds: 7,
  reps: 12,
};

describe('shareOgTitle', () => {
  it('leads with the score, which is what someone posts for', () => {
    expect(shareOgTitle(summary)).toBe('7 rounds + 12 · 12 min AMRAP');
  });

  it('omits reps when there are none', () => {
    expect(shareOgTitle({ ...summary, reps: 0 })).toBe('7 rounds · 12 min AMRAP');
  });

  it('falls back to the product name for an unknown share', () => {
    expect(shareOgTitle(null)).toBe('AMRAP With Friends');
  });
});

describe('shareOgImage', () => {
  it('uses the uploaded card', () => {
    expect(shareOgImage(summary, 'https://amrapwithfriends.com', 'https://db.supabase.co')).toBe(
      'https://db.supabase.co/storage/v1/object/public/mission-shares/abc12345.png'
    );
  });

  it('falls back to the default image when the card never uploaded', () => {
    // A broken image in a group chat looks worse than the generic one, and the
    // generic one still says what the product is.
    expect(
      shareOgImage({ ...summary, imagePath: null }, 'https://amrapwithfriends.com', 'https://db.co')
    ).toBe('https://amrapwithfriends.com/og-image-f.png');
    expect(shareOgImage(null, 'https://amrapwithfriends.com', 'https://db.co')).toBe(
      'https://amrapwithfriends.com/og-image-f.png'
    );
  });

  it('falls back when the storage url is not configured at the edge', () => {
    expect(shareOgImage(summary, 'https://amrapwithfriends.com', null)).toBe(
      'https://amrapwithfriends.com/og-image-f.png'
    );
  });
});

describe('shareOgDescription', () => {
  it('describes the product either way', () => {
    expect(shareOgDescription(summary)).toContain('friends');
    expect(shareOgDescription(null)).toContain('AMRAP');
  });
});

describe('shareOgImageSize', () => {
  const summary = {
    shareId: '4jppeegd',
    imagePath: '4jppeegd.webp',
    templateId: null,
    durationMinutes: 15,
    rounds: 10,
    reps: 28,
  };

  it('declares the landscape card, which is what the card render actually is', () => {
    // Facebook picks its large-image layout from these before fetching the
    // file, so declaring 1200x630 for a 1080x608 card costs the layout.
    expect(shareOgImageSize(summary)).toEqual({ width: 1080, height: 608 });
  });

  it('declares the site social image when there is no card', () => {
    expect(shareOgImageSize({ ...summary, imagePath: null })).toEqual({ width: 1200, height: 630 });
    expect(shareOgImageSize(null)).toEqual({ width: 1200, height: 630 });
  });
});
