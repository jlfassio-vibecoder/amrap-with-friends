export interface SafetyNotice {
  id: string;
  title: string;
  body: string;
}

/** Plain-language safety notices shown when opening a session waiting room. */
export const SESSION_SAFETY_NOTICES: SafetyNotice[] = [
  {
    id: 'warm-up',
    title: 'Warm up first',
    body: 'Before you start, do a proper dynamic warm-up. Warming up helps reduce the risk of injury. Taking part in this workout is voluntary and at your own risk. This app does not give medical advice.',
  },
  {
    id: 'exercise-readiness',
    title: 'Review the movements',
    body: 'Read the instructions for every exercise before you begin. Only do movements you can perform without pain through a full range of motion. If you cannot, stop and get medical advice. This app does not give medical advice. You participate at your own risk.',
  },
];
