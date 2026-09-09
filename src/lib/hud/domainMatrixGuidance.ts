/**
 * Athlete-facing copy for Domain Matrix ⓘ disclosures.
 *
 * Evidence informs the coaching (ACSM variety, residual fatigue after hard
 * efforts, multi-intensity weekly mix, longer-horizon base + intensity dose).
 * Clock domains are not HR zones — we never claim a literal 80/20 split.
 * The >60% single-domain warning is our product guardrail, not an AMRAP RCT.
 */

export type DomainMatrixWindowLabel = '72-hour' | '7-day' | '30-day';

export type DomainMatrixGuidance = {
  /** Passed to HudInfoDisclosure `label` (screen-reader “What does … mean?”). */
  disclosureLabel: string;
  paragraphs: string[];
};

const SHARED_BAR_OPENER =
  'The bar is the share of your locked core minutes — Sprint, Crucible, Grind, and Marathon. Active Recovery is listed beside the bar but is not part of it, so easy volume cannot hide a lopsided hard mix.';

const SHARED_IMBALANCE =
  'If one core domain takes more than about 60% of those minutes, the card warns you. That cut-off is our coaching guardrail for this product, not a published AMRAP study threshold — use it as a nudge to diversify, not as a medical rule.';

export const DOMAIN_MATRIX_GUIDANCE: Record<DomainMatrixWindowLabel, DomainMatrixGuidance> = {
  '72-hour': {
    disclosureLabel: '72-hour domain matrix',
    paragraphs: [
      SHARED_BAR_OPENER,
      'This window covers roughly the last three days — the stretch where hard work still leaves residual neuromuscular and metabolic fatigue. A fat segment means that energy-system and tissue stress pattern is still hot.',
      'Sprint (3–5) and Crucible (7–10) hit short anaerobic power and near-redline cardio hard; Grind and Marathon ask more of paced and long aerobic pathways. Stacking the same high-stress format again before those tissues recover is where overuse risk and a fatigued energy system stack up.',
      'If Sprint or Crucible already dominate this bar, prefer Active Recovery or a different core domain for the next mission. Diversify so you are not loading the same fatigued pattern twice.',
      SHARED_IMBALANCE,
    ],
  },
  '7-day': {
    disclosureLabel: '7-day domain matrix',
    paragraphs: [
      SHARED_BAR_OPENER,
      'This is your weekly dispersal across formats. Cardiorespiratory fitness and durable tissue health come from a range of intensities and durations — not from living in one clock length.',
      'When volume allows, aim to touch all four core formats in a training week: Sprint for short anaerobic bursts, Crucible for high cardio held for minutes, Grind for paced aerobic stamina, and Marathon for long-range aerobic work. Neglecting one leaves that system undertrained; overloading one overworks the tissues that format taxes.',
      'Active Recovery is useful easy volume. It does not replace balance among the four core domains.',
      SHARED_IMBALANCE,
    ],
  },
  '30-day': {
    disclosureLabel: '30-day domain matrix',
    paragraphs: [
      SHARED_BAR_OPENER,
      'This is the longer outlook — habit across about a month. Empty domains for a full month mean you are missing the adaptations that clock is built for.',
      'Over a month, most minutes should lean toward sustained aerobic clocks (Grind and Marathon) for base fitness and tissue resilience, with regular Sprint and Crucible providing the high-intensity dose. Avoid a month of only redline shorts or only mid-length grinds.',
      'That mix follows the same idea as endurance intensity distribution — lots of sustainable work, enough hard work — mapped onto our clocks, not heart-rate zones. Do not read this bar as a literal 80/20 zone split.',
      SHARED_IMBALANCE,
    ],
  },
};
