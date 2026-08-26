export interface ActivityTypeOption {
  /** Stable machine id — must match a row in the activity_type_catalog migration. */
  id: string;
  label: string;
}

export interface ActivityCategory {
  id: string;
  label: string;
  activities: ActivityTypeOption[];
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  {
    id: 'running_walking',
    label: 'Running & Walking',
    activities: [
      { id: 'run', label: 'Run' },
      { id: 'trail_run', label: 'Trail Run' },
      { id: 'treadmill_run', label: 'Treadmill Run' },
      { id: 'jog', label: 'Jog' },
      { id: 'walk', label: 'Walk' },
      { id: 'hike', label: 'Hike' },
    ],
  },
  {
    id: 'cycling',
    label: 'Cycling',
    activities: [
      { id: 'road_bike', label: 'Road Bike' },
      { id: 'mountain_bike', label: 'Mountain Bike' },
      { id: 'e_mountain_bike', label: 'E-Mountain Bike' },
      { id: 'e_bike', label: 'E-Bike' },
      { id: 'cruiser_bike', label: 'Cruiser Bike' },
      { id: 'gravel_bike', label: 'Gravel Bike' },
      { id: 'bmx', label: 'BMX' },
      { id: 'indoor_cycling', label: 'Indoor / Stationary Bike' },
      { id: 'spin_class', label: 'Spin Class' },
    ],
  },
  {
    id: 'swimming_water',
    label: 'Swimming & Water Sports',
    activities: [
      { id: 'pool_swim', label: 'Pool Swim' },
      { id: 'open_water_swim', label: 'Open Water Swim' },
      { id: 'surfing', label: 'Surfing' },
      { id: 'paddleboarding', label: 'Paddleboarding (SUP)' },
      { id: 'kayaking', label: 'Kayaking' },
      { id: 'rowing_water', label: 'Rowing (Water)' },
      { id: 'water_polo', label: 'Water Polo' },
      { id: 'water_skiing', label: 'Water Skiing' },
    ],
  },
  {
    id: 'strength_gym',
    label: 'Strength & Gym',
    activities: [
      { id: 'weightlifting', label: 'Weightlifting' },
      { id: 'powerlifting', label: 'Powerlifting' },
      { id: 'bodyweight_training', label: 'Bodyweight Training' },
      { id: 'circuit_training', label: 'Circuit Training' },
      { id: 'functional_fitness', label: 'Functional Fitness' },
    ],
  },
  {
    id: 'mind_body',
    label: 'Mind & Body',
    activities: [
      { id: 'yoga', label: 'Yoga' },
      { id: 'pilates', label: 'Pilates' },
      { id: 'stretching_mobility', label: 'Stretching / Mobility' },
      { id: 'tai_chi', label: 'Tai Chi' },
    ],
  },
  {
    id: 'winter_sports',
    label: 'Winter Sports',
    activities: [
      { id: 'snowboarding', label: 'Snowboarding' },
      { id: 'skiing_downhill', label: 'Skiing (Downhill)' },
      { id: 'cross_country_skiing', label: 'Cross-Country Skiing' },
      { id: 'ice_skating', label: 'Ice Skating' },
      { id: 'snowshoeing', label: 'Snowshoeing' },
    ],
  },
  {
    id: 'racket_court_sports',
    label: 'Racket & Court Sports',
    activities: [
      { id: 'tennis', label: 'Tennis' },
      { id: 'pickleball', label: 'Pickleball' },
      { id: 'badminton', label: 'Badminton' },
      { id: 'table_tennis', label: 'Table Tennis' },
      { id: 'squash', label: 'Squash' },
      { id: 'racquetball', label: 'Racquetball' },
    ],
  },
  {
    id: 'team_field_sports',
    label: 'Team & Field Sports',
    activities: [
      { id: 'basketball', label: 'Basketball' },
      { id: 'baseball', label: 'Baseball' },
      { id: 'softball', label: 'Softball' },
      { id: 'soccer', label: 'Soccer' },
      { id: 'football', label: 'Football' },
      { id: 'volleyball', label: 'Volleyball' },
      { id: 'ice_hockey', label: 'Ice Hockey' },
      { id: 'field_hockey', label: 'Field Hockey' },
      { id: 'lacrosse', label: 'Lacrosse' },
      { id: 'rugby', label: 'Rugby' },
      { id: 'cricket', label: 'Cricket' },
      { id: 'ultimate_frisbee', label: 'Ultimate Frisbee' },
    ],
  },
  {
    id: 'combat_martial_arts',
    label: 'Combat & Martial Arts',
    activities: [
      { id: 'boxing', label: 'Boxing' },
      { id: 'kickboxing', label: 'Kickboxing' },
      { id: 'brazilian_jiu_jitsu', label: 'Brazilian Jiu-Jitsu' },
      { id: 'judo', label: 'Judo' },
      { id: 'karate', label: 'Karate' },
      { id: 'wrestling', label: 'Wrestling' },
      { id: 'mma_training', label: 'MMA Training' },
    ],
  },
  {
    id: 'indoor_cardio',
    label: 'Indoor Cardio',
    activities: [
      { id: 'rowing_machine', label: 'Rowing Machine' },
      { id: 'elliptical', label: 'Elliptical' },
      { id: 'stair_climber', label: 'Stair Climber' },
      { id: 'jump_rope', label: 'Jump Rope' },
    ],
  },
  {
    id: 'outdoor_adventure',
    label: 'Outdoor & Adventure',
    activities: [
      { id: 'golf', label: 'Golf' },
      { id: 'rock_climbing', label: 'Rock Climbing' },
      { id: 'skateboarding', label: 'Skateboarding' },
      { id: 'horseback_riding', label: 'Horseback Riding' },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    activities: [{ id: 'other', label: 'Other' }],
  },
];

export const ALL_ACTIVITY_TYPE_IDS: string[] = ACTIVITY_CATEGORIES.flatMap((category) =>
  category.activities.map((activity) => activity.id)
);

export function findActivityCategoryByActivityId(activityId: string): ActivityCategory | null {
  return (
    ACTIVITY_CATEGORIES.find((category) =>
      category.activities.some((activity) => activity.id === activityId)
    ) ?? null
  );
}

export function findActivityLabel(activityId: string): string | null {
  for (const category of ACTIVITY_CATEGORIES) {
    const match = category.activities.find((activity) => activity.id === activityId);
    if (match) {
      return match.label;
    }
  }
  return null;
}
