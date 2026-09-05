import { afterEach, describe, expect, it } from 'vitest';
import {
  POST_AUTH_PATH_KEY,
  clearPostAuthPathIntent,
  consumePostAuthPathIntent,
  peekPostAuthPathIntent,
  resolvePostAuthDestination,
  safePostAuthPath,
  setPostAuthPathIntent,
} from './postAuthDestination';

afterEach(() => {
  clearPostAuthPathIntent();
});

describe('safePostAuthPath', () => {
  it('accepts same-origin relative paths only', () => {
    expect(safePostAuthPath('/create')).toBe('/create');
    expect(safePostAuthPath('/mission/abc?x=1')).toBe('/mission/abc?x=1');
    expect(safePostAuthPath('//evil.example')).toBeNull();
    expect(safePostAuthPath('https://evil.example')).toBeNull();
    expect(safePostAuthPath(null)).toBeNull();
  });
});

describe('resolvePostAuthDestination', () => {
  it('stays put on guest-open paths', () => {
    expect(resolvePostAuthDestination({ pathname: '/join' })).toBeNull();
    expect(resolvePostAuthDestination({ pathname: '/mission/abc' })).toBeNull();
    expect(resolvePostAuthDestination({ pathname: '/rally-point/abc' })).toBeNull();
    expect(resolvePostAuthDestination({ pathname: '/campaign/join' })).toBeNull();
    expect(resolvePostAuthDestination({ pathname: '/squad/join' })).toBeNull();
  });

  it('honors an explicit safe next when not on a guest-open path', () => {
    expect(resolvePostAuthDestination({ pathname: '/', next: '/hud' })).toBe('/hud');
  });

  it('defaults to /create and ignores /intake as next', () => {
    expect(resolvePostAuthDestination({ pathname: '/' })).toBe('/create');
    expect(resolvePostAuthDestination({ pathname: '/my-missions' })).toBe('/create');
    expect(resolvePostAuthDestination({ pathname: '/', next: '/intake' })).toBe('/create');
    expect(resolvePostAuthDestination({ pathname: '/', next: '/intake?next=/create' })).toBe(
      '/create'
    );
  });
});

describe('post-auth path intent', () => {
  it('stores, peeks, and consumes a safe path once', () => {
    setPostAuthPathIntent('/create');
    expect(peekPostAuthPathIntent()).toBe('/create');
    expect(sessionStorage.getItem(POST_AUTH_PATH_KEY)).toBe('/create');
    expect(consumePostAuthPathIntent()).toBe('/create');
    expect(peekPostAuthPathIntent()).toBeNull();
  });

  it('ignores unsafe intent values', () => {
    setPostAuthPathIntent('//evil.example');
    expect(peekPostAuthPathIntent()).toBeNull();
  });
});
