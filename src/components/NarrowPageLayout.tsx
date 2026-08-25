import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';

interface NarrowPageLayoutProps {
  title: string;
  subtitle?: string;
  showFooter?: boolean;
  desktopTitleAsPageHeading?: boolean;
  hideDesktopTitle?: boolean;
  contentMaxWidthClassName?: string;
  /** Large faded brand mark behind page content (home). */
  brandWatermark?: boolean;
  children: ReactNode;
}

export function NarrowPageLayout({
  title,
  subtitle,
  showFooter = true,
  desktopTitleAsPageHeading = false,
  hideDesktopTitle = false,
  contentMaxWidthClassName = 'max-w-xl',
  brandWatermark = false,
  children,
}: NarrowPageLayoutProps) {
  return (
    <main className="relative min-h-screen bg-page lg:flex lg:flex-col">
      {brandWatermark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <img
            src="/brand/logo.png"
            alt=""
            className="brand-watermark absolute left-1/2 top-[18%] w-[min(92vw,720px)] max-w-none -translate-x-1/2"
          />
        </div>
      ) : null}
      <AppHeader
        title={title}
        subtitle={subtitle}
        desktopTitleAsPageHeading={desktopTitleAsPageHeading}
        hideDesktopTitle={hideDesktopTitle}
      />
      <div className="relative z-10 flex-1 px-6 pb-6 pt-0 lg:px-8 lg:py-10">
        <div
          className={`mx-auto w-full space-y-6 ${contentMaxWidthClassName}`}
        >
          {children}
        </div>
      </div>
      {showFooter ? (
        <footer className="relative z-10 hidden pb-6 text-center text-xs text-muted lg:block">
          AMRAP With Friends
        </footer>
      ) : null}
    </main>
  );
}
