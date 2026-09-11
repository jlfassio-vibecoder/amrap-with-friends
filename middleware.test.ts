import { describe, it, expect } from 'vitest';
import middleware from './middleware';

const BOT = 'facebookexternalhit/1.1';
const BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function request(path: string, userAgent = BROWSER): Request {
  return new Request(`https://amrapwithfriends.com${path}`, {
    headers: { 'user-agent': userAgent },
  });
}

describe('middleware', () => {
  it('answers an unknown path with a real 404, not an empty 200 shell', async () => {
    const response = await middleware(request('/not-a-real-page'));
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, follow');
    await expect(response.text()).resolves.toContain('Page not found');
  });

  it('404s a path that only exists in development', async () => {
    expect((await middleware(request('/dev/timer'))).status).toBe(404);
  });

  it('lets a static content page through instead of 404ing it', async () => {
    for (const path of ['/amrap-timer', '/about', '/privacy', '/terms']) {
      const response = await middleware(request(path));
      expect(response.status, path).not.toBe(404);
      expect(response.headers.get('x-robots-tag'), path).toBe('index, follow');
    }
  });

  it('lets an indexable route through as indexable', async () => {
    const response = await middleware(request('/create'));
    expect(response.status).not.toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('index, follow');
  });

  it('lets the SPA shell through so cleanUrls rewrites can resolve', async () => {
    const response = await middleware(request('/_app-shell'));
    expect(response.status).not.toBe(404);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('marks private and ephemeral surfaces noindex without needing a render', async () => {
    for (const path of [
      '/rally-point/abc-123',
      '/mission/abc-123',
      '/hud',
      '/coach/wods',
      '/coach/articles',
    ]) {
      const response = await middleware(request(path));
      expect(response.headers.get('x-robots-tag'), path).toBe('noindex, follow');
      expect(response.status, path).not.toBe(404);
    }
  });

  // A room address is posted in bios and pasted into group chats, so the two
  // redirects below are the ones that decide whether those links keep working.
  it('normalizes a handle typed in the wrong case rather than serving two URLs', async () => {
    const response = await middleware(request('/@Bay_Area_CrossFit'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://amrapwithfriends.com/@bay_area_crossfit'
    );
  });

  it('keeps the query string when it normalizes the case', async () => {
    const response = await middleware(request('/@Coach_Maya?ref=story'));
    expect(response.headers.get('location')).toBe(
      'https://amrapwithfriends.com/@coach_maya?ref=story'
    );
  });

  it('404s a handle that could never be valid instead of asking the database', async () => {
    for (const path of ['/@ab', '/@has-a-hyphen', '/@_leading', '/@' + 'x'.repeat(25)]) {
      expect((await middleware(request(path))).status, path).toBe(404);
    }
  });

  it('does not treat a deeper path under a handle as a room', async () => {
    expect((await middleware(request('/@coach_maya/settings'))).status).toBe(404);
  });

  it('serves an unfurl card to a bot on an invite route', async () => {
    const response = await middleware(request('/join?m=abc', BOT));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('og:image');
    expect(html).toContain('<link rel="canonical" href="https://amrapwithfriends.com/join" />');
  });

  it('omits the canonical on an unfurl card for a noindex invite route', async () => {
    const html = await (await middleware(request('/squad/join', BOT))).text();
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('content="noindex, follow"');
  });

  it('never lets a query string break out of an attribute in the card', async () => {
    const html = await (await middleware(request('/join?m=%22onload%3Dalert(1)', BOT))).text();
    expect(html).not.toContain('onload=alert(1)');
  });

  it('passes a browser through to the app shell on an invite route', async () => {
    const response = await middleware(request('/join?m=abc'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
