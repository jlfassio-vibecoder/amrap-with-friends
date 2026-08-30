import { useEffect, useState } from 'react';

const HOLD_MS = 12000;
const DISSOLVE_MS = 4500;

const MALE_SRC = '/brand/logo-male.png';
const FEMALE_SRC = '/brand/logo-female.png';

type HeroLogoDissolveProps = {
  /** Container classes; default fills the hero column. */
  className?: string;
  /** Hide from AT when another emblem on the page already carries the label. */
  decorative?: boolean;
};

/**
 * Hero emblem: male and female brand marks crossfade (dissolve) on a loop.
 * Black PNG plates use mix-blend lighten so they drop out on the night ground.
 */
export function HeroLogoDissolve({
  className = 'mx-auto aspect-square w-full max-w-[min(100%,36rem)]',
  decorative = false,
}: HeroLogoDissolveProps) {
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [showFemale, setShowFemale] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    const id = window.setInterval(() => {
      setShowFemale((prev) => !prev);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  return (
    <div
      className={`relative aspect-square ${className}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'AMRAP With Friends emblem'}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src={MALE_SRC}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full object-contain mix-blend-lighten transition-opacity ease-in-out ${
          showFemale ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ transitionDuration: `${DISSOLVE_MS}ms` }}
      />
      <img
        src={FEMALE_SRC}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full object-contain mix-blend-lighten transition-opacity ease-in-out ${
          showFemale ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${DISSOLVE_MS}ms` }}
      />
    </div>
  );
}
