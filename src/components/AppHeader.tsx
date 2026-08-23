import { Link } from 'react-router-dom';
import { AuthHeaderActions } from '@/components/AuthHeaderActions';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** When true, the desktop header center title is the page's sole h1 (Home, Session). */
  desktopTitleAsPageHeading?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  desktopTitleAsPageHeading = false,
}: AppHeaderProps) {
  const desktopTitleClassName = 'text-display text-xl text-ink';

  return (
    <>
      <header className="hidden items-center justify-between gap-4 border-b border-divider bg-surface px-8 py-4 lg:flex">
        <Link className="text-display text-xl text-ink" to="/">
          AMRAP With Friends
        </Link>
        <div className="text-center">
          {desktopTitleAsPageHeading ? (
            <h1 className={desktopTitleClassName}>{title}</h1>
          ) : (
            <p className={desktopTitleClassName}>{title}</p>
          )}
          {subtitle ? <p className="text-sm text-secondary">{subtitle}</p> : null}
        </div>
        <AuthHeaderActions />
      </header>

      <div className="flex items-start justify-between gap-4 px-6 pt-6 lg:hidden">
        <div className="space-y-2">
          {desktopTitleAsPageHeading ? (
            <p className="text-display text-3xl text-ink">{title}</p>
          ) : (
            <h1 className="text-display text-3xl text-ink">{title}</h1>
          )}
          {subtitle ? <p className="text-sm text-secondary">{subtitle}</p> : null}
        </div>
        <AuthHeaderActions />
      </div>
    </>
  );
}
