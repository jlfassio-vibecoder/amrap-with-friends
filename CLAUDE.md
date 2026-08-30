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

| Term             | Means                                                                      | Where it belongs                                                        |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Session**      | One AMRAP workout, start to finish. The structural noun.                   | Buttons, page titles, routes — "Create session", `/session/:id`         |
| **Mission**      | That same workout's objective. The editorial noun.                         | Prose and headings only — "Today's mission", "Mission in progress"      |
| **Campaign**     | A multi-week programme (2–12 weeks, 1–5 sessions a week) with an end goal. | Buttons, page titles, routes. Always with its length: "8-week campaign" |
| **Squad**        | A persistent friends list for inviting people to train together. Not a session. | Buttons, page titles, routes, nav — "Your squad", `/squad`         |
| **Staging area** | The pre-workout screen where the crew gathers before the clock starts.     | Page title and any prose about that screen                              |
| **Rally link**   | The shared invite URL for a session. Never a squad invite.                 | The copy button, and prose about sharing                                |

**Session vs. mission.** Both name one workout, so each has a job. Session is
what the user creates, joins, and navigates to, so it owns the buttons and the
routes. Mission names the objective, so it owns the prose. "Today's mission is a
15-minute Blood Shunt" reads well; "Create mission" on a button does not,
because what the user is making is a session.

**Campaign and mission both need their duration attached.** Neither word
carries a sense of length on its own. Write "8-week campaign", never a bare
"Campaign" on a button.

### UI names that deliberately differ from the data layer

Do not "fix" these. Renaming a shipped RPC or column is migration risk for zero
user-visible benefit.

| Data layer                                                  | UI                                        |
| ----------------------------------------------------------- | ----------------------------------------- |
| `lobby` (`initial_lobby_schema.sql`, `lobby_countdown.sql`) | "Staging area"                            |
| `featured_wod_*`, `current_featured_wod()`                  | "Today's mission"                         |
| `sessions.state = 'work'`                                   | "Live"                                    |
| `rallySchedule.ts`, `buildRallyInviteUrl`, `RallyDay`       | (identifiers only — users never see them) |

`WOD` is CrossFit jargon: a newcomer cannot expand it. It is fine in coach-facing
tooling (the WOD Builder is used by coaches who know the term) and in internal
names. Keep it out of anything a first-time visitor reads.

### Words that failed the rule and were replaced

Kept here so they don't creep back in.

| Was                                       | Now                                     |
| ----------------------------------------- | --------------------------------------- |
| Engage staging area countdown timer       | Start countdown                         |
| LINK SECURED / ID SECURED                 | LINK COPIED / ID COPIED                 |
| Breach lobby / Breaching lobby            | Join session / Joining                  |
| Callsign (as a field label)               | Your name                               |
| Rally point                               | You've been invited                     |
| Featured WOD (on the landing card)        | Today's mission                         |
| Lobby opens shortly before start          | Staging area opens shortly before start |
| File the dossier / Your dossier was saved | Save profile / Your profile was saved   |
| Intake / Dossier (page titles)            | Your profile / Athlete details          |
| Enter temporary callsign (field label)    | Your name                               |
| Scheduled rallies                         | Scheduled sessions                      |
| Return to a lobby you scheduled for later | Return to a session you scheduled for later |
| T-Minus console                           | Set the countdown                       |
| Work (phase label)                        | Live                                    |

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
