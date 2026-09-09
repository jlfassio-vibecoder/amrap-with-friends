import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAttribution,
  classifyReferrer,
  isAttributable,
  parseUtm,
  persistAttribution,
  readStoredAttribution,
  referrerHost,
} from '@/lib/analytics/attribution';

const HOST = 'amrapwithfriends.com';

describe('referrerHost', () => {
  it('keeps only the host, never the path or query', () => {
    // Another site's URL can carry their user's personal data in the query.
    expect(referrerHost('https://www.google.com/search?q=someones+private+search')).toBe(
      'google.com'
    );
    expect(referrerHost('https://forum.example.org/thread/123?user=bob')).toBe('forum.example.org');
  });

  it('returns null for empty or unparseable referrers', () => {
    expect(referrerHost('')).toBeNull();
    expect(referrerHost('   ')).toBeNull();
    expect(referrerHost('not a url')).toBeNull();
  });
});

describe('classifyReferrer', () => {
  it('treats our own content pages as internal, not as a referral', () => {
    // The Astro site shares this origin; counting it would let the site take
    // credit for its own traffic.
    expect(classifyReferrer(`https://${HOST}/amrap-timer`, HOST)).toBe('internal');
    expect(classifyReferrer(`https://www.${HOST}/about`, HOST)).toBe('internal');
  });

  it('recognises search engines', () => {
    expect(classifyReferrer('https://www.google.com/', HOST)).toBe('organic_search');
    expect(classifyReferrer('https://duckduckgo.com/', HOST)).toBe('organic_search');
    expect(classifyReferrer('https://www.google.co.uk/', HOST)).toBe('organic_search');
  });

  it('recognises social sources including link shorteners', () => {
    expect(classifyReferrer('https://t.co/abc', HOST)).toBe('social');
    expect(classifyReferrer('https://x.com/someone', HOST)).toBe('social');
    expect(classifyReferrer('https://old.reddit.com/r/crossfit', HOST)).toBe('social');
  });

  it('falls back to referral, and to direct with no referrer', () => {
    expect(classifyReferrer('https://someblog.example/post', HOST)).toBe('referral');
    expect(classifyReferrer('', HOST)).toBe('direct');
  });
});

describe('parseUtm', () => {
  it('reads only the allowlisted keys', () => {
    expect(
      parseUtm('?utm_source=Reddit&utm_medium=Post&utm_campaign=Launch&evil=<script>')
    ).toEqual({ source: 'reddit', medium: 'post', campaign: 'launch' });
  });

  it('caps length and tolerates a missing leading question mark', () => {
    expect(parseUtm(`utm_source=${'a'.repeat(200)}`).source).toHaveLength(64);
  });

  it('returns nulls for an empty query', () => {
    expect(parseUtm('')).toEqual({ source: null, medium: null, campaign: null });
  });
});

describe('buildAttribution', () => {
  it('lets an explicit campaign tag win over the referrer', () => {
    const attribution = buildAttribution({
      referrer: 'https://t.co/abc',
      search: '?utm_source=newsletter&utm_campaign=spring',
      pathname: '/plan',
      host: HOST,
    });
    expect(attribution.channel).toBe('campaign');
    expect(attribution.source).toBe('newsletter');
    expect(attribution.campaign).toBe('spring');
  });

  it('falls back to the referrer host as the source when untagged', () => {
    const attribution = buildAttribution({
      referrer: 'https://www.google.com/',
      search: '',
      pathname: '/amrap-workouts/10',
      host: HOST,
    });
    expect(attribution.channel).toBe('organic_search');
    expect(attribution.source).toBe('google.com');
    expect(attribution.landingPath).toBe('/amrap-workouts/10');
  });
});

describe('isAttributable', () => {
  it('rejects internal navigation and keeps everything else', () => {
    const internal = buildAttribution({
      referrer: `https://${HOST}/about`,
      search: '',
      pathname: '/plan',
      host: HOST,
    });
    const direct = buildAttribution({ referrer: '', search: '', pathname: '/', host: HOST });
    expect(isAttributable(internal)).toBe(false);
    expect(isAttributable(direct)).toBe(true);
  });
});

describe('stored attribution', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a stored first touch', () => {
    const attribution = buildAttribution({
      referrer: 'https://someblog.example/x',
      search: '',
      pathname: '/',
      host: HOST,
    });
    persistAttribution(attribution);
    expect(readStoredAttribution()).toEqual(attribution);
  });

  it('survives corrupt storage rather than throwing on boot', () => {
    localStorage.setItem('amrap_first_touch', '{not json');
    expect(readStoredAttribution()).toBeNull();
    localStorage.setItem('amrap_first_touch', '{"channel":123}');
    expect(readStoredAttribution()).toBeNull();
  });

  it('survives storage access throwing, as it does in a private window', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredAttribution()).toBeNull();
    expect(() =>
      persistAttribution(buildAttribution({ referrer: '', search: '', pathname: '/', host: HOST }))
    ).not.toThrow();
  });
});
