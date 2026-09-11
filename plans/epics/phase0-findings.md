# Phase 0 findings — Onboarding activation

**Captured:** 2026-09-10 via local `/coach` against production data  
**Epic:** [onboarding-activation.md](./onboarding-activation.md)  
**Method:** Coach Funnels (7d / 30d / all), Users, Content & acquisition, Explore. Direct SQL (checklist 6–7) not run — service-role access was blocked in this session; waiting-room graveyard inferred from template + solo completion signals. Queries to run are at the bottom.

---

## Dominant drop (verdict)

Three stacked drops, not one:

| Rank | Drop | Evidence | Severity |
| ---- | ---- | -------- | -------- |
| **1** | **Browser → sign-up** | 148 guest browsers (7d) vs **7** registered profiles all-time; Facebook social ~31 browsers / **0** signed up (30d) | Volume — most “new users” never enter the product |
| **2** | **Sign-up → identity** | **6** Incomplete sign-ups (`needs_profile`) vs **7** registered — almost 1:1; five from 2026-08-25–27 (magic-link era), one 2026-09-08 | Blocks training for nearly half of accounts ever created |
| **3** | **Create → finish (solo / waiting room)** | 30d solo completion **20%** (70 missions) vs social **85.7%** (21); **First contact** 8 created / **0** completed; mid-work abandon beacons **0** | Among people who create, workouts die before Live finish — and not mid-clock |

Secondary: guest claim 6 prompts → 2 completed (30d, 33%). Real, smaller absolute volume than solo create→finish.

**Identity overlay itself is not the leak when shown:** Explore shows ~14 `micro_dossier_shown`, 13 `accepted`, **0** `cancelled`. When Launch opens the overlay, people accept.

---

## Checklist results

### 1. Acquisition (30d)

| Channel | Source | Browsers | Signed up | Completed a mission | Browser → completed % |
| ------- | ------ | --------:| ---------:| -------------------:| ---------------------:|
| Direct | — | 36 | 2 | 2 | 5.56% |
| Organic search | google.com | 20 | 1 | 1 | 5% |
| Social | facebook.com | 17 | 0 | 0 | 0% |
| Social | reddit (+ apps) | ~8 | 1 | 0 | 0% |
| Other FB / DDG | various | ~10 | 0 | 0 | 0% |

Coach UI no longer surfaces the “trained” (any participant row) column — only signed up and completed. Do not treat acquisition “completed” as Start; it is locked-score completion.

### 2. Incomplete sign-ups vs registered

| Cohort | Count |
| ------ | ----:|
| Registered users (`athlete_profiles`) | 7 |
| Incomplete sign-ups (stuck list) | 6 — all `needs_profile` |
| Profiles with **0 missions** (Users table) | **3** — Mamun, mrrossrogers, Steve |
| Profiles with missions | 4 (incl. Coach test account) |

Stuck emails (status all “Signed up — profile not started”): rebeccamshedd (2026-09-08), plus five 2026-08-25–27 accounts. Providers: email.

### 3. Intake / micro-dossier

| Signal | Window | Value |
| ------ | ------ | ----- |
| Intake submitted / abandoned | 7d | 1 / 0 |
| Intake submitted / abandoned | 30d | 8 / 0 |
| `micro_dossier_shown` (Explore, recent) | ~all recent | ~14 rows |
| `micro_dossier_accepted` | ~all recent | 13 |
| `micro_dossier_cancelled` | — | **0** (“No events yet”) |

Intake funnel “Incomplete sign-ups” tile = submit/abandon events, **not** the stuck-user list. Do not conflate them.

### 4. Missions created vs finished

| Metric | Value |
| ------ | ----:|
| Created 7d / finished 7d | 24 / 11 (~46%) |
| Created 30d / finished 30d | 78 / 32 (~41%) |
| `mission_created` analytics events (top strip / Explore) | **26** |
| Practice started | 4 |

**Gap:** 78 missions created (30d) vs 26 `mission_created` events — most rows are not client-tracked (featured scheduler, room, chain, etc.). Activation instrumentation must not rely on that event alone for “created.”

### 5. Drop-off / social vs solo (30d)

| Group | Missions | Athletes | Completed % | Returned 14d % |
| ----- | -------:| --------:| -----------:| --------------:|
| Social | 21 | 4 | **85.71%** | 100% |
| Solo | 70 | 4 | **20%** | 80% |

Mid-work abandon: **0%** (0 beacons vs 32 finished). People are not quitting the clock — they never get a finished mission, or never reach Live.

Template smoke: **First contact** 8 created / 0 completed; several short templates at 0%; coach featured template 11/11 100%.

Sign-up (30d): password 11 attempted / 8 completed / 3 failed (duplicates + invalid credentials on sign-in). Google attempts 0 in funnel (completions unobservable).

Host vs joiner (30d): Host 4 users (avg 9.25 missions); Joiner 1 user (10 missions). Tiny n.

Week-1 return among those who *did* finish a first mission: **75%** — retention after a real finish is healthy.

### 6–8. SQL (not executed this session)

Inferred without SQL:

- Profile complete + 0 missions: **3 / 7** from Users (checklist 6 partially answered in UI).
- Waiting graveyard: strongly suggested by First contact 0/8 + solo 20% + zero mid-work abandons; **not confirmed** as `state = waiting` without SQL.
- `mission_created` → countdown: Explore shows 26 `mission_created` and 20 `rally_point_countdown_started` (recent window / limit 100) — suggestive of create-without-countdown, but Start can also skip or re-fire countdown; need `mission_started` or state transition.

Run these in the Supabase SQL editor (service role / dashboard) to close 6–8:

```sql
-- 6. Profile complete, zero finished missions (and zero any mission)
WITH complete AS (
  SELECT user_id, username, nickname, created_at
  FROM public.athlete_profiles
  WHERE nullif(btrim(username), '') IS NOT NULL
    AND nullif(btrim(nickname), '') IS NOT NULL
),
mission_touch AS (
  SELECT
    p.user_id,
    count(*) AS participant_rows,
    count(*) FILTER (
      WHERE m.state = 'finished'
         OR EXISTS (
           SELECT 1 FROM public.participant_segment_results psr
           WHERE psr.participant_id = p.id
             AND psr.segment_index = m.segment_index
             AND psr.final_score IS NOT NULL
         )
    ) AS finishedish
  FROM public.participants p
  JOIN public.missions m ON m.id = p.mission_id
  WHERE p.user_id IS NOT NULL
  GROUP BY p.user_id
)
SELECT
  c.user_id,
  c.username,
  c.nickname,
  c.created_at,
  coalesce(mt.participant_rows, 0) AS missions_touched,
  coalesce(mt.finishedish, 0) AS finished_missions
FROM complete c
LEFT JOIN mission_touch mt ON mt.user_id = c.user_id
WHERE coalesce(mt.finishedish, 0) = 0
ORDER BY c.created_at DESC;

-- 7. Waiting / setup graveyard (never reached work)
SELECT
  state,
  count(*) AS missions,
  count(*) FILTER (WHERE created_at < now() - interval '2 hours') AS older_than_2h,
  count(*) FILTER (WHERE created_at < now() - interval '24 hours') AS older_than_24h
FROM public.missions
WHERE state IN ('waiting', 'setup')
GROUP BY state;

SELECT id, state, created_at, workout->>'name' AS workout_name
FROM public.missions
WHERE state IN ('waiting', 'setup')
  AND created_at < now() - interval '2 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 8. Created vs ever work/finished (30d)
SELECT
  count(*) AS created_30d,
  count(*) FILTER (WHERE state IN ('work', 'finished')) AS reached_work_or_finished,
  count(*) FILTER (WHERE state = 'finished') AS finished,
  count(*) FILTER (WHERE state IN ('waiting', 'setup')) AS still_waiting_or_setup
FROM public.missions
WHERE created_at >= now() - interval '30 days';
```

---

## Decision (Phase 0 exit)

**Instrument + one product track — not instrument-only.**

| Track | Why |
| ----- | --- |
| **Phase 1 instrumentation** (ship next) | Cannot prove Start vs never-entered-Live without `mission_started` / waiting-room events; create event undercounts DB creates |
| **Phase 2 coach Activation funnel** | Need signup → identity → create → Start → finish as one card; stuck list + acquisition alone hide the middle |
| **Product (Phase 3 candidates, ordered)** | (1) Nudge / default path for **profile complete, 0 missions** (e.g. Mamun after micro-dossier). (2) Solo **create → Start** for default templates (First contact 0/8) — waiting-room clarity / Start CTA on My missions. (3) Finish **JIT Phase 3/4** + ops for 6 `needs_profile` rows (historical). (4) Acquisition: Facebook → 0 signups is traffic quality, not post-auth UX. (5) Claim CTA only after Start gap is measurable |

**Do not** prioritize mid-workout abandon UX — beacons are empty and social finish rate is already high.

**Do not** treat micro-dossier cancel as the leak — cancel count is zero when the overlay shows.

---

## Funnel snapshot (mental model after Phase 0)

```
148 guest browsers / 7d
    → few signups (FB ~0%; Direct/Google ~5% browser→completed)
auth.users without profile: 6 stuck
athlete_profiles: 7  →  3 never touch a mission
missions 30d: 78 created → 32 finished (~41%)
    solo 20% finished | social 86% finished
mid-work abandon: ~0
week-1 return after first finish: 75%
```

North star for Phase 1–2: measure **identity-complete → first Live Start within 7 days**, not just finished or “trained.”
