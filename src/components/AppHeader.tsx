import { Link } from 'react-router-dom';
import { AuthHeaderActions } from '@/components/AuthHeaderActions';
import type { HeaderTone } from '@/components/headerTone';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** When true, the desktop header center title is the page's sole h1 (Mission). */
  desktopTitleAsPageHeading?: boolean;
  /**
   * Hide the header title on every breakpoint, leaving only the brand link and
   * the auth actions — for pages that carry their own page heading (Home, whose
   * landing hero owns the h1).
   */
  hidePageTitle?: boolean;
  /**
   * 'night' drops the header's own surface so it can sit on a dark section
   * (the landing hero) and recolours the links to match.
   */
  tone?: HeaderTone;
}

export function AppHeader({
  title,
  subtitle,
  desktopTitleAsPageHeading = false,
  hidePageTitle = false,
  tone = 'default',
}: AppHeaderProps) {
  const night = tone === 'night';
  const desktopTitleClassName = `text-display text-xl ${night ? 'text-night-ink' : 'text-ink'}`;
  const brandClassName = desktopTitleClassName;
  const desktopBarClassName = night
    ? 'border-b border-night-border'
    : 'border-b border-divider bg-surface';
  const subtitleClassName = `text-sm ${night ? 'text-night-secondary' : 'text-secondary'}`;
  const mobileTitleClassName = `text-display text-3xl ${night ? 'text-night-ink' : 'text-ink'}`;

  return (
    <>
      <header
        className={`hidden items-center justify-between gap-4 px-8 py-4 lg:flex ${desktopBarClassName}`}
      >
        <Link className={brandClassName} to="/">
          AMRAP With Friends
        </Link>
        <div className="text-center">
          {!hidePageTitle ? (
            desktopTitleAsPageHeading ? (
              <h1 className={desktopTitleClassName}>{title}</h1>
            ) : (
              <p className={desktopTitleClassName}>{title}</p>
            )
          ) : null}
          {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
        </div>
        <AuthHeaderActions tone={tone} />
      </header>

      <div className="flex items-start justify-between gap-4 px-6 pt-6 lg:hidden">
        <div className="space-y-2">
          {!hidePageTitle ? (
            desktopTitleAsPageHeading ? (
              <p className={mobileTitleClassName}>{title}</p>
            ) : (
              <h1 className={mobileTitleClassName}>{title}</h1>
            )
          ) : null}
          {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
        </div>
        <AuthHeaderActions tone={tone} />
      </div>
    </>
  );
}
