import type { PacingZone } from '@/lib/pacing/pacingGauge';

export const GAUGE_ZONE_NAME: Record<PacingZone, string> = {
  optimal: 'On pace',
  warning: 'At the limit',
  overtime: 'Overtime',
};
