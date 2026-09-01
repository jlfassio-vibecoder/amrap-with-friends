import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';

function anchor(): HTMLAnchorElement {
  return screen.getByRole('link') as HTMLAnchorElement;
}

/**
 * The href is identical either way, so that is not the thing to assert on.
 * react-router's Link intercepts a plain left click and preventDefaults it;
 * a real anchor lets the browser navigate. That is the actual difference.
 */
function clickIsIntercepted(): boolean {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  fireEvent(anchor(), event);
  return event.defaultPrevented;
}

describe('AppLink', () => {
  afterEach(cleanup);

  it('routes client-side for an app route inside a Router', () => {
    render(
      <MemoryRouter>
        <AppLink to="/create">Create</AppLink>
      </MemoryRouter>
    );
    expect(anchor().getAttribute('href')).toBe('/create');
    expect(clickIsIntercepted()).toBe(true);
  });

  it('falls back to a real navigation for a content route the SPA cannot render', () => {
    render(
      <MemoryRouter initialEntries={['/create']}>
        <AppLink to="/">Home</AppLink>
      </MemoryRouter>
    );
    expect(anchor().getAttribute('href')).toBe('/');
    expect(clickIsIntercepted()).toBe(false);
  });

  it('renders a plain anchor with no Router at all, as in an Astro island', () => {
    render(<AppLink to="/create">Create</AppLink>);
    expect(anchor().getAttribute('href')).toBe('/create');
    expect(clickIsIntercepted()).toBe(false);
  });

  it('passes attributes through', () => {
    render(
      <AppLink to="/join" className="link-accent" aria-label="Join">
        Join
      </AppLink>
    );
    expect(anchor().className).toBe('link-accent');
    expect(anchor().getAttribute('aria-label')).toBe('Join');
  });
});
