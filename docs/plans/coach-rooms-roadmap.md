# Coach's Rooms — implementation roadmap

_Companion to [coach-rooms-feature-plan.md](coach-rooms-feature-plan.md) · 10 September 2026_

The feature plan settles **what** and **why**. This settles **in what order**, **against
what that already exists**, and **what has to be true before each phase can start**.

Read §1 first: four of the plan's stated reuses are not in the codebase, and one
of them sits underneath Phase 1.

---

## 1. Corrections to the plan, before sequencing

These are places where the plan describes existing capability that is not there.
Each one is a cost the roadmap has to carry somewhere.

### 1.1 There is no referral system to reuse — this is the big one

§8 lists under **Reuse**: "the referral cookie and `home_coach` field."

Neither exists. `src/lib/analytics/attribution.ts` captures an _acquisition
channel_ — referrer host, utm tags, landing path — to give the SEO work a
feedback loop. It is first-touch marketing attribution written to
`analytics_events`. It has no concept of a coach, no cookie carrying a coach
identity, and no column on any table. Grep confirms: `home_coach`, `referred_by`
and `referral` appear in **zero** migrations.

So the plan's most important sequencing decision — "referral accounting starts in
phase 1 … or founding hosts' early commissions are lost" — is correct in
principle and underfunded in practice. The ledger is not a table added next to an
existing mechanism; the whole attribution mechanism is Phase 1 work.

**Impact:** Phase 1 grows by the home-coach concept end to end — column,
set-once-if-empty rule, the RPC that writes it, and the ledger rows keyed to it.

### 1.2 `workout_snapshot_id` names an entity that does not exist

The `workout_publications` sketch references `workout_snapshot_id`. There is no
`workout_snapshots` table. The established pattern is a **`workout` jsonb column
copied onto the row** — `missions.workout`, and campaigns keeping "their stored
workout jsonb" so an edited template cannot retroactively change a recorded
result (CLAUDE.md, _Changing a benchmark workout_).

**Decision needed before Phase 3.** Recommend following the existing pattern:
`workout_publications.workout jsonb` + `template_id`, no new entity. Standings
compare on a content fingerprint, which the repo already computes for benchmarks
(`benchmarkFingerprints.ts`) and which is exactly the "same workout version" test
§5 asks for.

### 1.3 No Stripe, and an internal contradiction about entitlements

Stripe appears nowhere in the repo. That is consistent with it being Phase 4 —
but §8 says "Entitlements are maintained **only** from verified Stripe webhook
events," while §7 has founding hosts getting a row with `source = 'founding'` in
Phase 1, years before a webhook exists.

**Resolve as:** entitlements are written by (a) verified Stripe webhooks, and
(b) an explicit admin path for `source in ('founding','pilot')`. Say so in the
policy, or Phase 1 has to violate its own rule on day one.

### 1.4 No transactional email

§5 says reminders are "Email only (Resend is already planned for auth)."
_Planned_, not built — `resend` appears only in `src/vite-env.d.ts`. Phase 2's
reminders therefore carry an unbudgeted dependency: provider account, sending
domain and DNS, a scheduled job, a template, unsubscribe handling, and bounce
tolerance. That is not a checkbox on the room page.

**Recommend:** ICS ships in Phase 2; email reminders move to **Phase 2b** so a
mail-infrastructure problem cannot block the room page.

### 1.5 The Astro OG shell is the wrong solution, and the right one is already built

§4 proposes "a prerendered `/@handle` shell with OG tags that redirects into the
app; regenerate it on a handle or branding change." Astro builds at deploy time,
so a host created on Tuesday has no page until the next deploy, and every handle
or logo change needs a full site redeploy.

**This exact problem is already solved for share links.** `/s/:shareId` is
registered in `DYNAMIC_CONTENT_ROUTES` so the edge middleware serves the SPA
shell instead of a 404, and `src/lib/share/shareShell.ts::injectShareMeta`
injects per-link OG tags at the edge with no build step. Rooms should do the
same: one route entry, one meta-injection branch. No Astro shell, no
regeneration, no second copy of the page.

### 1.6 Smaller items

| Item              | Note                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `citext`          | Never used in this database. Handles can use `text` + `lower()` unique index, or the extension gets enabled in Phase 1. Pick one.                                                    |
| `coach_users`     | Referenced across **8 migrations**. §8's "grep every use before shipping" is a real task, not a caution.                                                                             |
| Vocabulary        | **Room** is a new top-level noun and belongs in CLAUDE.md's table, which is the authoritative list.                                                                                  |
| `/creators` copy  | The "squad → room" copy fix lands on `site/pages/creators.astro`, rewritten days ago in #166. Coordinate rather than revert.                                                         |
| Roster ceiling    | A room mission is a live mission: `mission_participant_limit()` is **250**, and realtime fan-out is O(N²·R). A room with 300 members cannot run one mission for all of them. See §5. |
| Migration hygiene | 197 migrations already; two branches picking one timestamp has bitten three times. `npm run check:migrations` and the git hook are mandatory on this build.                          |

---

## 2. Phase 0 — Decisions and vocabulary (days, not weeks)

No product code. Cheap, and everything downstream forks on it.

**Deliverables**

1. CLAUDE.md vocabulary table gains **Room**, with the squad/room boundary
   written down.
2. `/creators` copy: "squad" → "room" where it means the coach's community.
3. Written decisions on: handle storage (`citext` vs `lower()` index), workout
   publication shape (§1.2), and the entitlement write paths (§1.3).
4. Handle reserved-word list, checked against every literal path in
   `src/lib/seo/routes.ts` — `/creators`, `/blog`, `/exercises`, `/s`,
   `/mission`, `/rally-point`, `/squad`, `/amrap-workouts`, `/amrap-timer`.

**Gate:** a first-time reader can tell room from squad from mission without
asking.

---

## 3. Phase 1 — Room boundary and ledger

The plan's Phase 1, plus the attribution work §1.1 uncovered. Nothing user-facing
ships; this phase exists so that everything after it is authorized correctly and
so founding hosts' commissions accrue from their first mission.

**Deliverables**

- `host_accounts`, `rooms`, `room_handle_history`, `room_members`, `room_invites`,
  `entitlements`.
- **Home coach**: column, the set-once-if-empty rule as a pure function with
  tests, and the RPC that writes it.
- **`referral_ledger`**, writing `attributed` rows from the first pilot mission.
  `purchase` / `refund` rows wait for Phase 4; the table and the write path do not.
- `room_id nullable` on `missions` and `campaigns`; scheduled generation copies it.
- RLS policies and `SECURITY DEFINER` RPCs for every read and write above.
- Room dashboard **shell** at a new route, structurally separate from `/coach`.
- The `coach_users` audit: every one of the 8 migrations, plus client callers.

**Explicitly not in Phase 1:** room page, publishing, reminders, Stripe, UI polish.

**Gates — all are release checks from §11, written as tests:**

| Check                                            | Why it gates                                    |
| ------------------------------------------------ | ----------------------------------------------- |
| Member of room A cannot read room B              | The whole authorization model                   |
| Co-host revoked mid-mission drops to participant | Stated in §3; easy to implement only in UI      |
| Co-host never matches `coach_users`              | Platform-role widening is the expensive mistake |
| Home coach set once, never overwritten           | Silent commission reassignment otherwise        |
| Ledger row written on room join + finish         | Phase 4 has nothing to pay out from without it  |

**Risk:** this phase is invisible and larger than the plan implies. Resist
pulling the room page forward to have something to show — Phase 2 renders in days
once the boundary is right, and in weeks if it isn't.

---

## 4. Phase 2 — The return loop

The first phase anyone can see. The plan's Phase 2, with reminders split out.

**2a — Room page and the join loop**

- `/@handle` in the app, registered in `DYNAMIC_CONTENT_ROUTES`, OG tags injected
  at the edge (§1.5). `index: true` for rooms; the handle-history redirect answers
  the old path for 90 days.
- Identity, next mission, workout collection, activity list, pinned announcement,
  reactions.
- Coach dashboard: publish, schedule, "run this again," copy invite, who finished
  and who returned, manage co-hosts and members.
- **The single post-finish sheet** (§4): share → save result → join room checkbox,
  home coach riding the same checkbox. One decision, three records.
- Room-branded share cards — the renderer already takes a layout and theme;
  rooms add a brand pair and the handle.
- ICS "add to calendar."

**2b — Email reminders** (separable; do not let it block 2a)

- Resend account, sending domain, DNS.
- 24h and 1h before a scheduled room mission, members opted in.
- Unsubscribe that works without an account.

**Gates**

- Guest finishes a room mission → claims into a **new** account → membership,
  result and attribution all correct.
- Same, claiming into an **existing** account that already has a different home
  coach: room joined, home coach unchanged, sheet says so.
- Handle change: old path redirects, share cards already in the wild still resolve.
- Timezone: viewer in a different zone from the room sees the right start time
  across a DST boundary.
- Unchecking the room box never blocks saving a result.

**This is the phase the primary metric measures.** Instrument
"second mission with the same host within 14 days" here, not in Phase 4.

---

## 5. Phase 3 — Train on your time

**Deliverables**

- `workout_publications` with the weekly window (room timezone) and the workout
  jsonb decided in Phase 0.
- Personal missions linked to a publication; never joining a finished live mission.
- Standings that combine only same-version, same-scoring-rule, same-scaling-tier
  completions; **first attempt of the week** counts; scaling tiers are separate
  lists.
- Campaign integration.

**Gates**

- Two independent completions in one window → the first counts, the second is
  visible in personal history.
- A workout edited after publication does not retroactively change a recorded
  result (the benchmark-fingerprint rule, applied to publications).
- Live and independent completions appear in one labeled list.
- Window boundaries correct across DST in the room's timezone.

**Scale note.** This phase is where a room outgrows a mission. A 300-member room
cannot run one live mission (`mission_participant_limit()` = 250), and the live
cost is O(N²·R) — measured at 314 KB per snapshot and 100k realtime messages for
100 athletes over 20 minutes (#167). "Train on your time" is the release valve:
it scales linearly because nobody shares a clock. Worth stating as a product
position, not discovering during a pilot.

---

## 6. Validation gate — 3–5 founding hosts

Between Phase 3 and Phase 4, as the plan says. Concrete entry and exit:

**Entry:** a host can be onboarded, publish, schedule, run, and see who returned,
with a founding entitlement row and a ledger accruing.

**Exit — measure, then decide:**

- Athletes completing a **second** mission with the same host within 14 days
  (primary).
- Hosts scheduling a **second** mission within 14 days of their first. A host who
  runs one and stops is the other way this dies, and it is cheaper to detect.
- Guest finish → claim rate, and "train on your time" completions per publication.

Do not build Phase 4 on a hypothesis the pilot has not tested. If hosts do not
return, the problem is not billing.

---

## 7. Phase 4 — Monetization automation

- Stripe checkout, customer portal, renewals.
- Webhook-driven entitlements, idempotent on `event_id`; "confirming" state on
  return from checkout until the webhook lands.
- Cancellation → read-only room; reactivation restores.
- Connect payouts driven by the ledger that has been accruing since Phase 1.

**Gates**

- Webhook replay is idempotent.
- Subscription expiring **during** a scheduled mission: the mission finishes.
- Read-only room: page and history stay, generation and reminders stop.
- Ledger totals reconcile against Stripe before a single payout.

---

## 8. Sequencing summary

| Phase | Ships                               | Blocked by | Main risk                                 |
| ----- | ----------------------------------- | ---------- | ----------------------------------------- |
| 0     | Decisions, vocabulary               | —          | Skipped, then re-litigated in code review |
| 1     | Boundary, roles, home coach, ledger | 0          | Invisible; bigger than it looks (§1.1)    |
| 2a    | Room page, join loop, dashboard     | 1          | Post-finish sheet regressing claim rate   |
| 2b    | Email reminders                     | 2a         | Mail infrastructure from zero             |
| 3     | Weekly publication, standings       | 2a         | Standings rules leaking across screens    |
| —     | **Founding-host validation**        | 3          | Building 4 on an untested hypothesis      |
| 4     | Stripe, payouts                     | gate       | Money bugs; webhook ordering              |

**The two orderings that matter most, and why:**

1. **Ledger before payouts.** Already the plan's call, and §1.1 makes it more
   urgent, not less: there is no existing attribution to lean on, so if Phase 1
   skips it, there is nothing to reconstruct from.
2. **Boundary before page.** Every authorization mistake here is a cross-room data
   leak or an accidental platform-role grant, and both are far cheaper to prevent
   than to find.

---

## 9. What I would change about the plan itself

- **Move the referral/home-coach build into Phase 1 explicitly.** Today it reads
  as reuse and is net-new (§1.1).
- **Drop the Astro `/@handle` shell** in favour of the edge meta injection already
  shipped for `/s/:shareId` (§1.5).
- **Split reminders out of Phase 2** so mail infrastructure cannot hold the room
  page hostage (§1.4).
- **Reconcile the entitlement write-path contradiction** (§1.3).
- **Name the roster ceiling as a product boundary.** 250 is a real number now, and
  a gym with 400 members will ask.
