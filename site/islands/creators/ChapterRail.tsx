import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#what', label: 'The room' },
  { href: '#socials', label: 'Your socials' },
  { href: '#growth', label: 'Your growth' },
  { href: '#estimate', label: 'Your revenue' },
  { href: '#week', label: 'Your week' },
  { href: '#apply', label: 'Apply' },
] as const;

/**
 * Sticky chapter rail with IntersectionObserver highlight.
 * Targets must exist as section ids on the page.
 */
export default function ChapterRail() {
  const [active, setActive] = useState<string>(LINKS[0]!.href);

  useEffect(() => {
    const targets = LINKS.map((link) => document.querySelector(link.href)).filter(
      (el): el is Element => el !== null
    );
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setActive(`#${entry.target.id}`);
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <nav className="creators-rail" aria-label="Page chapters">
      {LINKS.map((link) => (
        <a key={link.href} href={link.href} className={active === link.href ? 'is-active' : ''}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
