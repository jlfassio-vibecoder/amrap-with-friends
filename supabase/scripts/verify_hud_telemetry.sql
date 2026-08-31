-- Manual verification for hud_telemetry week bounds (run as authenticated user or via set_config).
-- pgTAP / supabase local can be added later for automated SQL tests.

-- 1) Invalid timezone is rejected
-- SELECT public.hud_telemetry('Not/A_Real_Zone');
-- Expect: {"ok": false, "reason": "invalid_timezone"}

-- 2) Inspect local week bounds for America/Los_Angeles without needing seed data.
-- A lock at Sunday 23:59 local must fall in [week_start, week_end).
-- A lock at Monday 00:01 local must fall in the *next* week.

WITH params AS (
  SELECT
    'America/Los_Angeles'::text AS tz,
    (now() AT TIME ZONE 'America/Los_Angeles')::date AS local_today
),
bounds AS (
  SELECT
    tz,
    local_today,
    local_today - ((extract(isodow FROM local_today)::int) - 1) AS week_start_local,
    (local_today - ((extract(isodow FROM local_today)::int) - 1))::timestamp
      AT TIME ZONE tz AS week_start_ts,
    ((local_today - ((extract(isodow FROM local_today)::int) - 1)) + 7)::timestamp
      AT TIME ZONE tz AS week_end_ts
  FROM params
),
fixtures AS (
  SELECT
    b.*,
    -- Current week's Sunday 23:59:00 local
    ((b.week_start_local + 6)::timestamp + interval '23 hours 59 minutes')
      AT TIME ZONE b.tz AS sunday_2359_ts,
    -- Next week's Monday 00:01:00 local
    ((b.week_start_local + 7)::timestamp + interval '1 minute')
      AT TIME ZONE b.tz AS monday_0001_ts
  FROM bounds b
)
SELECT
  week_start_local,
  week_start_ts,
  week_end_ts,
  sunday_2359_ts,
  monday_0001_ts,
  (sunday_2359_ts >= week_start_ts AND sunday_2359_ts < week_end_ts)
    AS sunday_in_current_week,
  (monday_0001_ts >= week_start_ts AND monday_0001_ts < week_end_ts)
    AS monday_in_current_week
FROM fixtures;

-- Expect:
--   sunday_in_current_week = true
--   monday_in_current_week = false

-- 3) Authenticated smoke call (must be signed in as a user with JWT):
-- SELECT public.hud_telemetry('America/Los_Angeles');
-- Expect Phase 4 shape:
-- {
--   "ok": true,
--   "telemetry": {
--     "weekMinutes": <int>,
--     "weekPviAverage": <num|null>,
--     "weekEndsAt": <timestamptz>,
--     "lastLockedAt": <timestamptz|null>,
--     "attrition": [<bool x 12>],
--     "domainMinutes30d": { "5": <int>, "10": <int>, "15": <int>, "20": <int>, "other": <int> },
--     "classification": {
--       "current": "unclassified"|"civilian"|"operator"|"special_ops",
--       "previous": "unclassified"|"civilian"|"operator"|"special_ops",
--       "progress": {
--         "weekMinutes": <int>,
--         "intensity3PlusCount": <int>,
--         "intensity4PlusCount": <int>,
--         "marathon20Count": <int>
--       }
--     }
--   }
-- }
-- attrition length must be 12; index 11 = current local week; index 0 = 11 weeks ago.
-- A week is true iff sum(duration_minutes) of claimed+locked missions in that Mon–Sun >= 150.
-- domainMinutes30d uses rolling now() - 30 days on score lock time; other = non 5/10/15/20.
-- NULL intensity_tier counts as 2 for lethality; custom/historical cannot fill I3+/I4+ quotas alone.
