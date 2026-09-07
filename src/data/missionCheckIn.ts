/**
 * Post-mission check-in: RPE, single-click dimensions, and free-text notes.
 *
 * Option ids are frozen. They are stored against results, so an id that changes
 * meaning silently rewrites history — the same rule as scaling ladder ids.
 * `missionCheckIn.test.ts` pins the current set.
 *
 * Check-ins never change the score, load, or intensity. They are optional so
 * honesty stays free to give.
 */

export interface RpeOption {
  value: number;
  /** Short label shown with the number (Easy → Max). */
  label: string;
}

export type CheckInDimensionId = 'energy' | 'starting_soreness' | 'sleep' | 'mood' | 'pain';

export interface CheckInOption {
  /** Frozen. Stored against results. */
  id: string;
  label: string;
}

export interface CheckInDimension {
  id: CheckInDimensionId;
  /** Athlete-facing group title. */
  title: string;
  options: CheckInOption[];
}

/** 1–10 with short labels. Values are what we store; labels are display-only. */
export const RPE_OPTIONS: readonly RpeOption[] = [
  { value: 1, label: 'Very easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Light' },
  { value: 4, label: 'Steady' },
  { value: 5, label: 'Moderate' },
  { value: 6, label: 'Hard' },
  { value: 7, label: 'Very hard' },
  { value: 8, label: 'Brutal' },
  { value: 9, label: 'Near max' },
  { value: 10, label: 'Max' },
];

export const CHECK_IN_DIMENSIONS: readonly CheckInDimension[] = [
  {
    id: 'energy',
    title: 'Energy',
    options: [
      { id: 'energy--low', label: 'Low' },
      { id: 'energy--ok', label: 'OK' },
      { id: 'energy--high', label: 'High' },
    ],
  },
  {
    id: 'starting_soreness',
    title: 'Starting soreness',
    options: [
      { id: 'soreness--none', label: 'None' },
      { id: 'soreness--mild', label: 'Mild' },
      { id: 'soreness--heavy', label: 'Heavy' },
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep last night',
    options: [
      { id: 'sleep--poor', label: 'Poor' },
      { id: 'sleep--ok', label: 'OK' },
      { id: 'sleep--good', label: 'Good' },
    ],
  },
  {
    id: 'mood',
    title: 'Mood / headspace',
    options: [
      { id: 'mood--off', label: 'Off' },
      { id: 'mood--steady', label: 'Steady' },
      { id: 'mood--locked-in', label: 'Locked in' },
    ],
  },
  {
    id: 'pain',
    title: 'Pain',
    options: [{ id: 'pain--felt', label: 'Felt pain' }],
  },
];

/**
 * Shown whenever `pain--felt` is selected or stored.
 * Frozen with the option ids — silent edits of this disclaimer fail CI.
 */
export const PAIN_CHECK_IN_WARNING =
  'If you felt pain during this workout, discontinue any exercise that causes pain. Seek medical attention if necessary. This app does not give medical advice.';
