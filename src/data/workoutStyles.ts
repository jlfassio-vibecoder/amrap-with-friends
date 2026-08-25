import type { WorkoutCategory } from '@/data/workoutTemplates';

export interface WorkoutStyleInfo {
  name: string;
  protocol: string;
  outcomes: [string, string];
}

export const WORKOUT_STYLE_INFO: Record<WorkoutCategory, WorkoutStyleInfo> = {
  'blood-shunt': {
    name: 'Blood Shunt',
    protocol:
      'Alternates extreme upper-body and lower-body movements to aggressively shunt blood across the core — forcing the cardiovascular system to adapt to rapidly shifting mechanical demands, triggering massive caloric expenditure and vascular elasticity.',
    outcomes: ['Elite visceral fat burning', 'Operator-level metabolic conditioning'],
  },
  'localized-trap': {
    name: 'Localized Trap',
    protocol:
      'Compounds movements targeting a single muscle group with zero transition time — forcing deep-tissue structural growth and training the limbs to continue contracting despite acute lactic acid pooling and localized muscular failure.',
    outcomes: ['Tier 1 muscle hypertrophy', 'Localized acid buffering'],
  },
  'engine-room': {
    name: 'Engine Room',
    protocol:
      'Relies on high-turnover, full-body metabolic movements against a strict clock — rapidly elevating the heart rate to improve oxygen utilization, clear metabolic waste, and forge undeniable tactical cardio endurance.',
    outcomes: ['Maximum VO2 expansion', 'Systemic work capacity'],
  },
  'midline-tension': {
    name: 'Midline Tension',
    protocol:
      'Pairs dynamic core mechanics with heavy static holds under cardiovascular stress — stripping away structural weaknesses to build a bulletproof core capable of bracing the body under extreme systemic fatigue.',
    outcomes: ['Absolute spinal fortification', 'Anti-collapse endurance'],
  },
  'aerobic-matrix': {
    name: 'Aerobic Matrix',
    protocol:
      'Focuses on foundational, continuous bodyweight movement to enforce disciplined pacing — hardening connective tissue and expanding Zone 3 and Zone 4 cardiovascular efficiency without pushing the central nervous system into absolute failure.',
    outcomes: ['Sustained caloric oxidation', 'Foundational aerobic base building'],
  },
  'four-point-cascade': {
    name: '4-Point Cascade',
    protocol:
      'Executes complex multi-joint sequences that tax all four quadrants of the body sequentially — forging elite motor control, agility, and neuromuscular coordination while forcing the athlete to operate under a haze of deep physical exhaustion.',
    outcomes: ['Total-body metabolic meltdown', 'Systemic CNS adaptation'],
  },
  'armor-protocol': {
    name: 'Armor Protocol',
    protocol:
      'Combines agonizing isometric holds with maximum-effort bursts — demanding total structural resilience to survive heavy oxygen debt, elevated heart rates, and complete systemic overload.',
    outcomes: ['Tier 1 psychological forging', 'Extreme hypoxic tolerance'],
  },
};
