/**
 * The canonical list of product analytics event names.
 *
 * Event names used to be bare string literals typed out three times over — at
 * the `track()` call site, again inside a reporting view in SQL, and a third
 * time in the coach Explore dropdown. Nothing tied the three together, which
 * is how `v_rally_conversion` and `v_mission_abandonment` spent a release
 * reading `session_joined` / `session_abandoned` after the client had moved to
 * `mission_*` and reported a hard zero (fixed in
 * `20260909310000_reporting_views_mission_event_names.sql`).
 *
 * This array is now the single source. `track()` accepts nothing else, the
 * Explore dropdown is built from it, and `events.test.ts` fails CI if a call
 * site, a reporting view, or the dropdown drifts from it.
 *
 * Adding an event: add the name here, then emit it. Renaming one is a data
 * migration, not a rename — `analytics_events.event_name` is stored text and
 * historical rows keep whatever they were written with, so move the old name
 * to RETIRED_ANALYTICS_EVENT_NAMES and have the view match both.
 */
export const ANALYTICS_EVENT_NAMES = [
  // Auth / sign-up
  'auth_google_started',
  'auth_google_failed',
  'auth_sign_in_failed',
  'auth_sign_in_succeeded',
  'auth_signed_in',
  'auth_sign_up_attempted',
  'auth_sign_up_failed',
  'auth_sign_up_needs_confirmation',
  'auth_sign_up_succeeded',

  // Onboarding: micro-dossier, intake, guest → account claim
  'micro_dossier_shown',
  'micro_dossier_accepted',
  'micro_dossier_cancelled',
  'intake_submitted',
  'intake_abandoned',
  'intake_save_failed',
  'claim_prompt_shown',
  'claim_completed',
  'claim_conflict',

  // Missions
  'mission_created',
  'mission_joined',
  'mission_abandoned',
  'mission_chain_advanced',
  'mission_id_copied',
  'practice_started',
  'practice_finished',
  'template_selected',
  'coach_workout_selected',
  'physical_activity_logged',

  // Rally point / invites
  'rally_link_copied',
  'rally_point_created',
  'rally_point_joined',
  'rally_point_closed',
  'rally_point_next_mission',
  'rally_point_host_reassigned',
  'rally_point_countdown_started',
  'rally_point_countdown_canceled',
  'command_passed',

  // Plan hub
  'plan_hub_chain_launched',
  'plan_hub_campaign_started',

  // Campaigns
  'campaign_created',
  'campaign_invite_copied',

  // Today's mission
  'featured_wod_viewed',
  'featured_wod_joined',
  'featured_wod_calendar_saved',

  // Acquisition
  'first_touch_captured',

  // Platform / reliability
  'audio_unlock_result',
  'rpc_call',
  'realtime_status',
  'realtime_correction',
  'presence_heartbeat',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/**
 * Names no longer emitted, but still present in `analytics_events` rows
 * written before a rename. Reporting views must keep matching these
 * alongside the current name or they silently truncate history.
 */
export const RETIRED_ANALYTICS_EVENT_NAMES = [
  'session_created', // → mission_created
  'session_joined', // → mission_joined
  'session_abandoned', // → mission_abandoned
] as const;
