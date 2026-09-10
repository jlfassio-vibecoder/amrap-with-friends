import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { isAppRoute } from '@/lib/seo/routes';

interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

/**
 * A link that knows whether client-side routing can actually serve its target.
 *
 * Two things make a plain `<Link>` wrong now. Components on the home page render
 * inside Astro islands, where there is no Router at all — a `<Link>` there throws.
 * And the content pages Astro builds are not in the SPA's route table, so a
 * `<AppLink to="/">` from inside the app would push a history entry the SPA cannot
 * render. Both cases want a real navigation.
 *
 * So: `<Link>` only when we are inside a Router *and* the target is a route the
 * SPA serves. Everything else is an anchor, and the browser does the work.
 */
export function AppLink({ to, children, ...rest }: AppLinkProps) {
  const inRouter = useInRouterContext();

  if (inRouter && isAppRoute(to)) {
    return (
      <Link to={to} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}
