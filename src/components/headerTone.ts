/**
 * Header chrome tone. 'night' is for the landing page, where the nav sits on
 * the hero's dark navy ground instead of the app's light surface.
 */
export type HeaderTone = 'default' | 'night';

export const HEADER_TONE_CLASSES = {
  default: {
    link: 'link-accent',
    mutedLink: 'text-secondary hover:text-accent',
    muted: 'text-muted',
  },
  night: {
    link: 'text-gold hover:text-night-ink',
    mutedLink: 'text-night-secondary hover:text-gold',
    muted: 'text-night-secondary',
  },
} as const satisfies Record<HeaderTone, Record<string, string>>;
