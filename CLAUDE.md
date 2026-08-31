# AMRAP With Friends

A standalone web app for running social AMRAP workout sessions in real time.
React 19 + Vite + TypeScript + Tailwind on the front end, Supabase (Postgres +
RLS + RPCs + Realtime) on the back.

See [README.md](README.md) for setup, scripts, and Supabase deployment.

## Vocabulary

The product has a deliberate military/tactical identity — OPERATOR
classifications, the Crucible, the Attrition Grid, tactical audio cues. That is
the brand and it stays. What matters is _where_ it goes.

### The rule

> If a word sits on something you **click**, or names a state you must
> understand to proceed, write it in plain English with zero decoding.
> If it sits on something you **earn** or read at leisure, keep it bold.

`OPERATOR` as a classification you unlock is good — the mystique is the reward.
"Engage staging area countdown timer" as a button was not: five words and an
opaque verb for one action. Same brand, opposite sides of the line.

### The nouns

| Term            | Means                                                                                              | Where it belongs                                                        |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Session**     | One AMRAP workout, start to finish. The structural noun.                                           | Buttons, page titles, routes — "Create session", `/session/:id`         |
| **Mission**     | That same workout's objective. The editorial noun.                                                 | Prose and headings only — "Today's mission", "Mission in progress"      |
| **Campaign**    | A multi-week programme (2–12 weeks, 1–5 sessions a week) with an end goal.                         | Buttons, page titles, routes. Always with its length: "8-week campaign" |
| **Squad**       | A persistent friends list for inviting people to train together. Not a session.                    | Buttons, page titles, routes, nav — "Your squad", `/squad`              |
| **Rally point** | The pre-workout screen the rally link opens to, where the crew gathers and the mission is started. | Page title, buttons, routes — "Rally point", `/rally-point/:id`         |
| **Rally link**  | The shared invite URL that opens a rally point. Never a squad invite.                              | The copy button, and prose about sharing                                |
| **Benchmark**   | A campaign's opening session. Its score is the number the campaign is measured against.            | The badge on that session, and prose about it                           |
| **Retest**      | The same workout as the benchmark, run again later in the campaign.                                | The badge on those sessions                                             |
| **Easy day**    | The light session before a retest, so the test measures fitness not fatigue.                       | The badge on that session                                               |

**Benchmark, retest and easy day are the only session badges.** Everything else
in a campaign is just a session and gets no label — a badge on every row labels
nothing. They pass the click test because each one changes what the athlete
should do that day: go hard and record it, compare it, or hold back. Internally
the fourth role is `build`, which is deliberately never shown.

**Session vs. mission.** Both name one workout, so each has a job. Session is
what the user creates, joins, and navigates to, so it owns the buttons and the
routes. Mission names the objective, so it owns the prose. "Today's mission is a
15-minute Blood Shunt" reads well; "Create mission" on a button does not,
because what the user is making is a session.

**Campaign and mission both need their duration attached.** Neither word
carries a sense of length on its own. Write "8-week campaign", never a bare
"Campaign" on a button.

**Rally point is one word for one screen, all the way down.** It used to be
three: `lobby` in the data layer, "Staging area" in the UI, and "Rally point"
for the invite you had already been told to call a rally link. The rally link
now opens the rally point, and the schema says `rally_points` — so there is no
translation step left to get wrong. "Staging" is retired: staging is what the
My sessions page does, not what this screen is.

### UI names that deliberately differ from the data layer

Do not "fix" these. Renaming a shipped RPC or column is migration risk for zero
user-visible benefit.

| Data layer                                            | UI                                        |
| ----------------------------------------------------- | ----------------------------------------- |
| `featured_wod_*`, `current_featured_wod()`            | "Today's mission"                         |
| `sessions.state = 'work'`                             | "Live"                                    |
| `rallySchedule.ts`, `buildRallyInviteUrl`, `RallyDay` | (identifiers only — users never see them) |

`lobby` used to head that table. It was paid off in
`20260901390000_rally_point_rename.sql`, which renamed the tables, columns and
RPCs onto `rally_point` — cheap while the app was pre-release with three
unpaid users, and the reason the exception no longer needs to exist. The
migration files written before it keep `lobby` in their **filenames**, which is
correct: a migration is a dated record of what ran, not a description of the
current schema.

Two `rally` identifiers now sit side by side and mean different things.
`buildRallyInviteUrl(sessionId)` builds the rally link for one session;
`buildRallyPointInviteUrl(rallyPointId)` builds it for a rally point that
outlives the session. Both are rally links to the user.

`WOD` is CrossFit jargon: a newcomer cannot expand it. It is fine in coach-facing
tooling (the WOD Builder is used by coaches who know the term) and in internal
names. Keep it out of anything a first-time visitor reads.

### Words that failed the rule and were replaced

Kept here so they don't creep back in.

| Was                                       | Now                                         |
| ----------------------------------------- | ------------------------------------------- |
| Engage staging area countdown timer       | Start countdown                             |
| Staging area (page title)                 | Rally point                                 |
| Close staging area / Leave staging        | Close rally point / Leave rally point       |
| Open staging area / Schedule staging      | Open rally point / Schedule rally point     |
| Enter staging area / Join staging         | Enter rally point / Join rally point        |
| LINK SECURED / ID SECURED                 | LINK COPIED / ID COPIED                     |
| Breach lobby / Breaching lobby            | Join session / Joining                      |
| Callsign (as a field label)               | Your name                                   |
| Rally point (as the invite-landing title) | You've been invited                         |
| Featured WOD (on the landing card)        | Today's mission                             |
| Lobby opens shortly before start          | Rally point opens shortly before start      |
| File the dossier / Your dossier was saved | Save profile / Your profile was saved       |
| Intake / Dossier (page titles)            | Your profile / Athlete details              |
| Enter temporary callsign (field label)    | Your name                                   |
| Scheduled rallies                         | Scheduled sessions                          |
| Return to a lobby you scheduled for later | Return to a session you scheduled for later |
| Staging area not found                    | Rally point not found                       |
| T-Minus console                           | Set the countdown                           |
| Work (phase label)                        | Live                                        |

Workout and classification names are content, not chrome, and are untouched:
"The Hull Breach", "Blood Shunt", "Armor Protocol", "Crucible", "Tier 1".

## Architecture notes

- **Path alias** — `@/` resolves to `src/` (tsconfig, vite, and vitest configs
  all declare it). Import as `@/lib/...`, not by relative path.
- **All database access goes through RPCs.** Tables are RLS-locked and revoked
  from `anon`/`authenticated`; the client calls `SECURITY DEFINER` functions via
  `callRpc`. Do not add direct table queries from the client.
- **Pure logic lives in `src/lib/` and is unit tested.** Scoring, timer
  reduction, schedule maths, and presentation decisions are pure functions with
  their own `.test.ts` beside them. Put new logic there rather than inside a
  component — it is the repo's strongest convention and the reason the suite is
  large and fast.
- **A campaign's session roles are derived, never stored.** `campaign_occurrences`
  carries a `template_id` and nothing about what the session is _for_.
  `planCampaignWorkouts` keeps the benchmark out of the build rotation, so the
  only sessions running the first workout are the tests, and `deriveCampaignRoles`
  recovers benchmark/retest/easy-day from the schedule alone. That is why the
  create preview and the campaign detail page label sessions identically with no
  column, no migration, and no way for a stored role to drift from the workout
  actually scheduled. The benchmark ids in `campaignBenchmarks.ts` are the one
  thing that must never change: editing one invalidates every result recorded
  against it.
- **Changing a benchmark workout.** The score-affecting content of every
  benchmark id is frozen in `benchmarkFingerprints.ts` and asserted in CI.
  Fingerprints cover duration, category, and each movement's name / reps / unit
  — not display copy. To change a benchmark workout, add a new template with a
  new id, point the table in `campaignBenchmarks.ts` at it, and update
  `benchmarkFingerprints.ts` in the same commit. Do not edit the existing
  template in place: in-flight campaigns keep their stored workout jsonb, but
  comparisons across the edit would silently mix two different tests.
- **Scheduled sessions are generated, not pre-created.** A recurring rule lives
  in its own table and a per-minute `pg_cron` job materialises `sessions` rows in
  a tight window around each occurrence (see `run_featured_wod_scheduler()`).
  Sessions are never auto-started — the host presses Start.
- **Store local date + local time + timezone**, and resolve to an absolute
  instant only at generation time. Persisting a computed `timestamptz` weeks out
  breaks across a daylight-saving boundary.
- **Design tokens only.** Edit hex values in `src/index.css`; components use
  `var(--color-*)` or the semantic Tailwind utilities that map to them. Never
  hard-code a colour in a component.

## Before pushing

```bash
npm run lint && npm run typecheck && npm run test
```

CI runs exactly these three on Node 24. Prettier is configured with
`prettier-plugin-tailwindcss`, which reorders class names — run
`npx prettier --write <files>` on files you touched, not the whole repo, to
avoid unrelated formatting churn.
