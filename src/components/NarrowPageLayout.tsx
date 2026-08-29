import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';

interface NarrowPageLayoutProps {
  title: string;
  subtitle?: string;
  showFooter?: boolean;
  desktopTitleAsPageHeading?: boolean;
  contentMaxWidthClassName?: string;
  children: ReactNode;
}

export function NarrowPageLayout({
  title,
  subtitle,
  showFooter = true,
  desktopTitleAsPageHeading = false,
  contentMaxWidthClassName = 'max-w-xl',
  children,
}: NarrowPageLayoutProps) {
  return (
    <main className="relative min-h-screen bg-page lg:flex lg:flex-col">
      <AppHeader
        title={title}
        subtitle={subtitle}
        desktopTitleAsPageHeading={desktopTitleAsPageHeading}
      />
      <div className="relative z-10 flex-1 px-6 pb-6 pt-0 lg:px-8 lg:py-10">
        <div className={`mx-auto w-full space-y-6 ${contentMaxWidthClassName}`}>{children}</div>
      </div>
      {showFooter ? (
        <footer className="relative z-10 hidden pb-6 text-center text-xs text-muted lg:block">
          AMRAP With Friends
        </footer>
      ) : null}
    </main>
  );
}
