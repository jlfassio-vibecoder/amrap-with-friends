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

  it('lets an indexable route through as indexable', async () => {
    const response = await middleware(request('/create'));
    expect(response.status).not.toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('index, follow');
  });

  it('marks private and ephemeral surfaces noindex without needing a render', async () => {
    for (const path of ['/rally-point/abc-123', '/mission/abc-123', '/hud', '/coach/wods']) {
      const response = await middleware(request(path));
      expect(response.headers.get('x-robots-tag'), path).toBe('noindex, follow');
      expect(response.status, path).not.toBe(404);
    }
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
