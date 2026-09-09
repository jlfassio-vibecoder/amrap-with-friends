# Share Card + Replay — Implementation Plan

_Companion to [awf-share-card-and-replay-design.md](awf-share-card-and-replay-design.md). Written after
auditing the design against the codebase; where the two disagree, this document is the one that
matches the repo._

## Why this document exists

The design doc is sound on product and rendering, and it is the reference for the storyboard, the card
anatomy and the encoder strategy. But it was written from the outside and assumes schema and product
infrastructure that does not exist here. Building Part C verbatim would fail in the first migration.

## Design assumptions that do not hold

| Design says                                                          | Repo reality                                                                                                                                      | Consequence                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rounds.logged_at`; derive `atSeconds` from `logged_at - started_at` | `rounds.elapsed_sec_at_round int`, plus `mission_id` and `segment_index`                                                                          | **Simpler than designed.** The value is already stored. No timestamp arithmetic, no DST or clock-skew exposure. The RPC must scope to the mission's `segment_index`, which the design does not mention. |
| `missions.visibility`                                                | Does not exist                                                                                                                                    | Design open question 2 is a schema decision. Resolved below without adding the column.                                                                                                                  |
| `missions.kind = 'amrap' \| 'amqap'`                                 | Does not exist. AMQAP is a workout _source_ chosen at creation (`workoutSource === 'amqap'`), not persisted as a kind                             | The `amqap` card variant has no server-side signal. Deferred until one exists.                                                                                                                          |
| `missions.name`, `missions.code`                                     | Neither exists; there is `workout jsonb`, `template_id`, `duration_minutes`                                                                       | Card header uses the existing `resolveWorkoutTitle`.                                                                                                                                                    |
| `athlete_profiles.tier`, `.handle`, `.brand`, `.home_coach`          | None exist. Profiles carry `username` / `nickname`; coach identity is the `coach_users` allowlist, which is dashboard access, not a customer tier | Watermark policy, coach branding, `@handle` captions and referral attribution have nothing to read. Phase 4 is blocked; see below.                                                                      |
| Result screen identified by "I EARNED THIS"                          | That string is in `PartialRepsModal`. The finish screen is `MissionScorecard`, rendered from `MissionWaitingRoomPage`                             | Correct mount point for the panel.                                                                                                                                                                      |
| `src/features/share/`                                                | No `src/features/` exists                                                                                                                         | Repo convention is pure logic in `src/lib/` with colocated tests, components in `src/components/`.                                                                                                      |

## Things the design misses

1. **`/s/:id` must be registered in `src/lib/seo/routes.ts`.** The edge middleware answers unknown paths
   with a real 404 _before_ the SPA loads, so an unregistered share route is dead on arrival. Register it
   with `index: false` — share pages are ephemeral and should not be indexed.
2. **The OG-for-bots pattern already exists.** `middleware.ts` has `BOT_UA` and
   `OG_ROUTES = ['/join', '/campaign/join', '/squad/join']` and already returns hand-built unfurl HTML for
   crawlers. Phase 3 extends that switch; it does not need a new edge function.
3. **The referral cookie is now consent-gated.** A 60-day identifier is exactly what
   `src/lib/analytics/consent.ts` governs. In the EEA it cannot be set before consent, so attribution
   there will legitimately under-count. Design it in from the start rather than discovering it later.
4. **New analytics events must be registered.** `ANALYTICS_EVENT_NAMES` is enforced in CI; `track()`
   will not compile with an unregistered name.

## Decisions taken

- **Phase 4 is deferred**, not attempted. Its prerequisites — athlete tier, public handles, coach brand
  colours, `home_coach` — are business-plan infrastructure, not part of this feature. They are listed as
  separate work below.
- **Share pages show the card image, never a live board.** The uploaded PNG is public, because it has
  already been posted to social media; `get_mission_replay` stays participants-only. This needs no
  `visibility` column and never publishes another participant's data to someone holding a URL.
- **Layout follows the repo**: `src/lib/share/` for pure logic, `src/components/share/` for React.

## Phase 1 — Renderer, card, share sheet

Ships value alone: an athlete can post their result. No video, no storage, no link page.

**Migration**

- `mission_shares` per design B2, minus `image_path` usage until Phase 3. RLS insert mirrors the
  `submit-participant-result` guest pattern (`participants.claim_token_hash`); select public; no update.
- `get_mission_replay(p_mission_id uuid)`: `security definer`, caller must be a participant or the host.
  `atSeconds` reads `elapsed_sec_at_round`, clamped to `[0, cap]`, filtered to the mission's
  `segment_index`. `prior` returns null. `host.brand`, `host.handle`, `isCoach` return null — nothing to
  read them from yet.
- `athlete_profiles.share_visibility text not null default 'name' check in ('name','initials','hidden')`.
  This is the one profile column in scope: it is a privacy control, not a monetisation one, and the
  design correctly resolves display names **in SQL** so the client never receives a hidden name.
- `create_mission_share(...)`.

**Client**

- `src/lib/share/replayData.ts` — fetch + hand-written validator, fixture test.
- `src/lib/share/timeline.ts` — `frameAt(data, cap)`, freeze phase only. Tests for rank order and
  tie-breaks; reuse the existing scoring order rather than inventing one.
- `src/lib/share/renderer/` — `theme.ts`, `layouts/{story,square,landscape}.ts`, `drawFrame.ts`.
  Canvas 2D, no DOM, no React, so the same code runs in a Worker in Phase 2 and on a server later.
- `src/components/share/ShareCardPanel.tsx` — mounted in `MissionScorecard`.
- Watermark on **every** card. There is no tier to exempt.
- Register `share_card_rendered`, `share_opened`, `share_completed`.

**Risks.** Font loading before first draw (`document.fonts.ready`) or the first card is misaligned —
the design is right about this. `toBlob` on iOS is slower than Chrome; measure against the 500 ms budget
on a real device before adding variants.

## Phase 2 — Replay and MP4

As designed. Adds `mp4-muxer`. Full storyboard in `timeline.ts`, `race`/`finish` in `drawFrame.ts`,
WebCodecs in a Worker with the MediaRecorder fallback, `/dev/replay/:missionId` scrubber route
(register it in `routes.ts`, `index: false`).

The design's key insight holds and should be protected: everything is a pure function of
`(replayData, t)`, so the card is one frame and the replay is six hundred. Keep the renderer DOM-free.

## Phase 3 — Share link and unfurl

- Storage bucket `mission-shares`, public read, writes only via an edge function that verifies the caller.
- Extend `OG_ROUTES` / `BOT_UA` in `middleware.ts` for `/s/:id`, returning `og:image` from the stored PNG.
  Register `/s/:id` in `routes.ts`.
- `increment_share_view` with the day-level dedupe table.
- SPA route `/s/:id`: card image, join CTA to `/create`, and a "what is this" link.
- **No referral cookie in this phase** — there is no coach tier to attribute to, and the cookie would
  need consent gating in the EEA. Both land together with Phase 4.

## Phase 4 — Deferred, with named prerequisites

Blocked until these exist, each of which is its own piece of work:

1. `athlete_profiles.tier` (`free` / `pro` / `coach`) and whatever sets it.
2. Public handles (`@handle`), unique, with a `/@handle` route.
3. Coach brand colours with WCAG AA validation at save.
4. `home_coach` on profiles, and the referral cookie flow — including consent gating.
5. `missions.workout_key` for PR detection, plus a backfill.
6. A persisted `missions.kind` so the AMQAP card variant has a signal.

## Sequencing

Phase 1 alone is shippable and testable. Phase 2 is independent of Phase 3. Do 1 → 2 → 3, one PR each,
each ending with `npm run lint && npm run typecheck && npm run test` green per CLAUDE.md.
