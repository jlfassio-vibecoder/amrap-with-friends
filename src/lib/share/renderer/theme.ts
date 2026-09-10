import type { ShareLayout } from '@/lib/share/types';

/**
 * Card colours, resolved to literals.
 *
 * CLAUDE.md forbids hard-coded colours in components, and this is not one: a
 * Canvas has no CSS, and the renderer must run in a Worker and later on a
 * server, where `var(--color-ink)` resolves to nothing. These values mirror
 * src/index.css and are the one place they are duplicated — change both
 * together.
 */
export interface ShareTheme {
  background: string;
  ink: string;
  secondary: string;
  accent: string;
  onAccent: string;
  surface: string;
  border: string;
}

export const AWF_THEME: ShareTheme = {
  background: '#12100d',
  ink: '#f7f2ea',
  secondary: '#a8a096',
  accent: '#d4a017',
  onAccent: '#12100d',
  surface: '#1d1a15',
  border: '#332e26',
};

/** 1080 wide for every layout, so one grid and one type scale serve all three. */
export const CANVAS_WIDTH = 1080;
export const SAFE_AREA = 72;

export const TYPE_SCALE = { body: 40, label: 56, hero: 96, display: 160 } as const;

export interface LayoutSpec {
  width: number;
  height: number;
  /**
   * Instagram overlays its own UI over the top and bottom of a Story, so the
   * score and the link have to stay inside this band or they are covered.
   */
  safeTop: number;
  safeBottom: number;
}

export const LAYOUTS: Record<ShareLayout, LayoutSpec> = {
  story: { width: 1080, height: 1920, safeTop: 250, safeBottom: 300 },
  square: { width: 1080, height: 1080, safeTop: SAFE_AREA, safeBottom: SAFE_AREA },
  landscape: { width: 1080, height: 608, safeTop: SAFE_AREA, safeBottom: SAFE_AREA },
};

export const SHARE_FONT_STACK =
  '"Inter", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
