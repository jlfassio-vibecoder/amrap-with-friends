# Share Card + Mission Replay — Feature Design

*AMRAP With Friends · Draft v1 · September 2026*

Companion to the business plan §8. Goal: every finished mission produces a share card in under a second and an optional 20-second replay video in under 30 seconds, on a phone, with one tap to the OS share sheet. Both carry attribution back into the funnel.

---

## Part A — Product spec

### A1. What ships

| Artifact | What it is | When | Formats |
| -------- | ---------- | ---- | ------- |
| **Share card** | Static image of the athlete's result and the squad board | Rendered instantly on the finish screen | 9:16 (Story/TikTok), 1:1 (feed), 16:9 (X/YouTube thumbnail) |
| **Mission replay** | ~20s video reconstructed from the mission's round log — the squad's round bars racing, the clock, the final 15 seconds in real time, freeze on the card | On demand, tap "Make replay" | MP4 (H.264) 1080×1920; 1080×1080 optional |
| **Share link** | `amrapwithfriends.com/s/{shareId}` — printed on both artifacts and copied to the clipboard as a caption; unfurls with the card as its OG image | Created with the card | — |

Not a screen recording. Nothing is captured during the mission; the replay is *rendered* after the fact from data that already exists (`rounds` timestamps). No permissions, works on iOS Safari, deterministic, and re-renderable later with new templates.

### A2. Finish-screen flow

```
Mission clock hits cap (or athlete taps I EARNED THIS)
  │
  ▼
[submit-participant-result] locks score
  │
  ▼
Result screen
  ┌─────────────────────────────────────────────┐
  │  Share card preview (Story ratio, live)     │  ← rendered client-side < 500ms
  │                                             │
  │  [ Share ]   [ Make replay ]   [ Copy link ]│
  │  ratio toggle:  9:16 · 1:1 · 16:9           │
  └─────────────────────────────────────────────┘
  │
  ├─ Share ──────► navigator.share({ files:[png], text: caption })
  │                 fallback: download + "caption copied"
  │
  ├─ Make replay ► progress bar (rendering… encoding…)  ~10–30s
  │                 then same share sheet with the .mp4
  │
  └─ after first share/download (or dismiss):
       guest  ──► "Save this mission to my account" (existing claim flow)
                  + "Train with @host?" attachment prompt (business plan §5)
       member ──► back to My missions
```

Rules:

- The card is generated **before** the claim prompt. A guest who shares and leaves still put the host's handle and the link in front of their followers.
- Sharing never blocks on network. Card rendering and video encoding are fully client-side. The only network calls are (1) creating the `mission_shares` row and (2) uploading the card PNG so the link unfurls — both fire-and-forget.
- Free / guest artifacts carry a small AWF watermark bar. Athlete Pro and Coach-attached athletes get the clean version (this is a listed Pro feature).

### A3. Card content

**Anatomy (9:16):**

| Zone | Content | Source |
| ---- | ------- | ------ |
| Header | Workout name · cap (e.g. "12 min AMRAP") · date | `missions` |
| Hero | Athlete's score: `7 rounds + 12 reps`, display name, optional "PR" tag | `participants` + result |
| Squad board | Top 5 by score, athlete's row highlighted even if outside top 5 (shown as row 6 with "you") | `participants` |
| Host strip | Host avatar + `@handle` when hosted by a Coach-tier user; "Trained with @handle" badge if the athlete has that home coach | `athlete_profiles`, coach branding |
| Footer | `amrapwithfriends.com/s/abc123` · logo · watermark (free) | `mission_shares` |

**Variants (same data, different emphasis):**

1. `result` — default. Hero is my score.
2. `squad` — hero is the board; good for the host to post.
3. `pr` — auto-selected when the athlete beat their previous best on this workout (Pro, logged-in only). Shows old → new.
4. `amqap` — for AMQAP flows there is no score to brag about; card shows the flow family, minutes, and "quality rounds completed". Calmer palette. No leaderboard.

**Theming:** default AWF palette. Coach-hosted missions may apply the host's `brand` (primary/accent colors, avatar) — Coach tier only. Colors are validated for contrast at save time (WCAG AA against the card background) so a coach can't make an unreadable card.

**Names and privacy:** other participants appear as their display name. A profile setting `share_visibility: 'name' | 'initials' | 'hidden'` (default `name`) controls how someone appears on *other people's* cards and replays. Guests are treated as `name` for the mission they're in; the finish screen tells them this.

### A4. Replay storyboard (20 s, 30 fps)

| t (s) | Beat | What's on screen |
| ----- | ---- | ---------------- |
| 0–2 | Title | Workout name, cap, host handle. Squad names fade in as horizontal bars at 0 rounds. |
| 2–8 | Compressed race | Clock scrubs from 0:00 to cap−15s in 6 seconds. Bars grow as each participant's rounds land (from `rounds.logged_at`). Rank order re-sorts with eased transitions. Round-log "tick" SFX optional (muted by default — most social video is watched muted; keep it silent and clean). |
| 8–18 | Real-time finish | Clock runs the last 10 s at 1×. Last-round pops get a flash. Athlete's bar is highlighted. |
| 18–20 | Freeze | Final frame cross-fades into the share card layout. Hold. |

Alternative cut `story-9s`: 0–1 title, 1–5 compressed, 5–8 real-time last 3 s, 8–9 freeze. Offered when the mission had ≤2 participants (a two-person race doesn't need 20 s).

Everything in the storyboard is a pure function of `(replayData, t)`. That's what makes it cheap: the card is `renderFrame(data, t = cap, layout = 'card')`; the replay is the same function called 600 times.

### A5. Attribution and tracking

- Every generated card/replay creates a `mission_shares` row with a short `share_id`.
- `/s/{shareId}` is a public page: OG image = the uploaded card PNG, title = "{name} scored 7+12 on {workout}", CTA = **Join the next mission with @host** (deep-links to the host's `/@handle` page if Coach-hosted, otherwise to `/create`). Visiting sets the 60-day referral cookie for the host, per business plan §5.
- Events (Growth Engine schema): `share_card_rendered`, `replay_render_started`, `replay_render_completed` (duration, encoder path), `share_opened` (target ratio, kind), `share_completed` (Web Share promise resolved), `share_link_viewed`, `share_link_joined`.
- Success metrics from the plan: 300 user posts/mo by day 90, measured as `share_completed` + `share_link_viewed` from a non-owner session.

### A6. Out of scope for v1

Audio, custom text overlays, multi-mission highlight reels, server-side rendering (see D3 for when to add it), editing participant names on the card, direct posting via Instagram/TikTok APIs (share sheet covers this; API posting needs app review and adds nothing for the athlete).

---

## Part B — Technical design

### B1. Architecture

```
                 ┌────────────────────────────────────────────┐
                 │  Supabase                                  │
                 │  rpc get_mission_replay(mission_id) ──► jsonb
                 │  table mission_shares                      │
                 │  storage bucket mission-shares (png only)  │
                 └───────────────┬────────────────────────────┘
                                 │ ReplayData
                                 ▼
   ┌──────────────────────────────────────────────────────────┐
   │  src/features/share/                                     │
   │                                                          │
   │  replayData.ts      normalize RPC → ReplayData (pure)    │
   │  timeline.ts        (ReplayData, tSeconds) → FrameState  │
   │  renderer/          Canvas 2D: drawFrame(ctx, FrameState,│
   │     drawFrame.ts       layout, theme)                    │
   │     layouts/        story | square | landscape | card    │
   │     theme.ts        AWF default + coach brand override   │
   │                                                          │
   │  card/useShareCard.ts   drawFrame at t=cap → PNG blob    │
   │  replay/encode.ts       frames → MP4 (WebCodecs+mp4-muxer│
   │                         fallback MediaRecorder)          │
   │  replay/replay.worker.ts OffscreenCanvas + encoder       │
   │  share/shareSheet.ts    navigator.share / download       │
   │  share/createShare.ts   insert mission_shares + upload   │
   └──────────────────────────────────────────────────────────┘
```

One renderer, two consumers. No React inside the renderer — plain Canvas 2D so it runs in a Worker.

### B2. Data

**RPC `get_mission_replay(p_mission_id uuid) returns jsonb`** — `security definer`, allowed if the caller is a participant, the mission host, or the mission is public (`missions.visibility = 'public'`). Returns:

```ts
type ReplayData = {
  mission: {
    id: string; code: string; name: string; capSeconds: number;
    startedAt: string; endedAt: string | null;
    kind: 'amrap' | 'amqap'; visibility: 'public' | 'private';
  };
  host: {
    id: string; handle: string | null; displayName: string;
    avatarUrl: string | null; isCoach: boolean;
    brand: { primary: string; accent: string } | null;
  } | null;
  participants: Array<{
    id: string;                          // participant row id (guest or member)
    userId: string | null;
    displayName: string;                 // already resolved against share_visibility
    isMe: boolean;
    finalRounds: number; finalReps: number;
    prior: { rounds: number; reps: number } | null;   // best prior result on same workout, only for isMe
    homeCoachHandle: string | null;      // only for isMe
  }>;
  rounds: Array<{ participantId: string; n: number; atSeconds: number }>; // atSeconds relative to startedAt
};
```

Notes:

- `atSeconds` is computed in SQL from `rounds.logged_at - missions.started_at`. Clamp to `[0, capSeconds]`. Rounds logged after the cap (the grace window) clamp to cap.
- `displayName` resolution happens in the RPC, not the client: `name` → display name, `initials` → "J.F.", `hidden` → "Athlete 3". The client never sees the raw name of a hidden participant.
- `prior` requires the workout to have a stable identity. Use `missions.workout_key` (hash of the workout jsonb, or the library/Coach WOD id when present). Add the column if it doesn't exist; backfill is optional.

**Table `mission_shares`**

```sql
create table public.mission_shares (
  id            text primary key,                 -- 8-char base32, generated client-side then validated unique
  mission_id    uuid not null references missions(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  created_by    uuid references auth.users(id),   -- null for guests
  kind          text not null check (kind in ('card','replay')),
  layout        text not null check (layout in ('story','square','landscape')),
  variant       text not null check (variant in ('result','squad','pr','amqap')),
  image_path    text,                             -- storage path of the card png, set after upload
  views         int not null default 0,
  created_at    timestamptz not null default now()
);
-- RLS: insert allowed for participants/hosts of the mission (guests via the mission session token,
-- same mechanism submit-participant-result uses). Select public (the /s/ page reads it). Update: none from client.
create index on mission_shares (mission_id);
```

**Storage bucket `mission-shares`** — public read, insert only through the `create_share` RPC path (or an edge function) so a client can't overwrite someone else's image. Objects: `{shareId}.png`, ≤ 400 KB (encode PNG at 1080 wide, or WebP with PNG fallback). **Never upload video.** A 20-second 1080p MP4 is 5–15 MB; storing them for every share is the one thing that could make this feature expensive. The video lives on the phone.

**`/s/{shareId}` page** — needs server-rendered OG tags. The app is a Vite SPA on Vercel, so add a small Vercel Edge Function at `/s/[id]` that fetches `mission_shares` + mission summary, returns HTML with `og:image`, `og:title`, and a client redirect (or embedded mini-page) into the SPA. Increment `views` via an RPC `increment_share_view(share_id)` with a rate limit by IP hash, and set the referral cookie for `host.id` when the host is Coach tier.

### B3. Rendering

**`timeline.ts`** — the storyboard as a pure function:

```ts
type FrameState = {
  phase: 'title' | 'race' | 'finish' | 'freeze';
  clockSeconds: number;                 // what the clock displays
  bars: Array<{ participantId: string; rounds: number; reps: number; rank: number; y: number; highlight: boolean }>;
  flashes: Array<{ participantId: string; alpha: number }>;   // round-pop highlights
  cardBlend: number;                    // 0..1 crossfade into card layout during freeze
};
function frameAt(data: ReplayData, t: number, cut: 'full20' | 'story9'): FrameState
```

Mission time is mapped to video time piecewise (see A4). Rank changes use a 300 ms eased interpolation of `y`, keyed off the last re-sort time so bars slide rather than jump. Keep an LRU of the previous frame state to compute transitions; the function stays deterministic for a given `(data, t)` because transitions are derived from `rounds` timestamps, not from render order.

**`drawFrame.ts`** — Canvas 2D. Fonts: load `Inter` (or the app's display font) via `FontFace` before the first draw and await `document.fonts.ready`; text metrics are wrong otherwise and the first card comes out misaligned. Avatars: pre-fetch to `ImageBitmap` once per render session; if fetch fails, draw an initial in a circle. All colors from `theme.ts`.

Layouts share one grid: 1080 wide, safe area 72 px, type scale 40/56/96/160. Story adds top/bottom safe zones (Instagram overlays UI in the top 250 px and bottom 300 px — keep the score and link out of those).

**Card = `drawFrame(ctx, frameAt(data, cap), { layout, variant, theme })` → `canvas.toBlob('image/png')`.** Target < 500 ms on a 2020 iPhone. Render at 1080 wide; preview shows a CSS-scaled copy.

### B4. Video encoding

Priority order, feature-detected at runtime:

| Path | Where it works | Output | Notes |
| ---- | -------------- | ------ | ----- |
| **1. WebCodecs `VideoEncoder` (avc1.42E01E / 4D401F) + `mp4-muxer`** | Chrome/Edge/Android 94+, iOS/macOS Safari 16.4+ | MP4, plays everywhere, uploads to IG/TikTok | Hardware encoder on phones; 600 frames in ~5–15 s. Run in a Worker with `OffscreenCanvas`. |
| **2. `MediaRecorder` on `canvas.captureStream(30)`** with `video/mp4` if `isTypeSupported`, else `video/webm;codecs=vp9` | Older Safari (mp4 from 14.1), any Chrome (webm) | MP4 on Safari; WebM on Chrome | Real-time only (a 20 s clip takes 20 s to record). WebM will **not** upload to Instagram from iOS; if the only path is WebM, label the button "Download replay" and show a note. |
| **3. Card only** | Everything else | — | Hide "Make replay". |

Encoder settings: 1080×1920, 30 fps, ~6 Mbps, keyframe every 60 frames, `latencyMode: 'quality'`. Expected file: 8–12 MB for 20 s. Under Instagram's 100 MB and TikTok's limits with room to spare.

Progress UI: "Rendering frames 240/600" then "Encoding…", cancellable. On cancel, terminate the worker (don't try to reuse it). Cache the last rendered blob in memory so re-tapping Share doesn't re-encode.

Worker boundary: main thread fetches `ReplayData`, avatars as `ImageBitmap` (transferable), fonts already loaded in the worker via `self.fonts`. Worker posts `{ type: 'progress', frame }` and `{ type: 'done', blob }`. Fallback when `OffscreenCanvas` is missing: run the same code on the main thread with `requestIdleCallback` chunks of 10 frames.

### B5. Share sheet

```ts
async function shareArtifact(file: File, caption: string, shareId: string) {
  track('share_opened', …);
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: caption });   // resolves on completion, rejects on cancel
    track('share_completed', …);
  } else {
    downloadBlob(file);
    await navigator.clipboard.writeText(caption);
    toast('Saved. Caption copied — paste it when you post.');
  }
}
```

Caption template (also what the "Copy link" button copies):

> 7 rounds + 12 reps · 12 min AMRAP · with @handle's squad
> Join the next mission: amrapwithfriends.com/s/abc123

The share sheet must be called from a user gesture; encode first, then show a "Share replay" button — don't chain `share()` after the async encode or iOS will refuse it.

### B6. Attribution wiring (ties to business plan §5)

- `mission_shares.mission_id → missions.host_id`. The `/s/` edge function reads the host; if `athlete_profiles.tier = 'coach'`, set `awf_ref={hostHandle}` cookie (60 days, SameSite=Lax) before redirecting into the SPA. Existing referral code logic reads the same cookie.
- If the sharer has a `home_coach`, the caption's "with @handle" uses that coach, not the host, when they differ — the athlete's coach gets the credit for the athlete's post. Host still appears on the card.

### B7. Performance and cost budget

| Item | Budget |
| ---- | ------ |
| Card render | < 500 ms p95 on iPhone 12 |
| Replay full20 | < 30 s p95 on iPhone 12 (WebCodecs); < 25 s (MediaRecorder is real-time) |
| Card PNG upload | ≤ 400 KB; fire-and-forget; retried once |
| Storage growth | 300 shares/mo × 400 KB = 120 MB/mo. Trivial. Add a 12-month purge later if needed. |
| Egress | `/s/` OG images are the only egress; cache with `Cache-Control: public, max-age=31536000, immutable` (share images never change) |

### B8. When to add server-side rendering (not now)

Add a render worker (Node + `@napi-rs/canvas` + ffmpeg on a small VPS or a Vercel function with a ffmpeg layer) only if telemetry shows `replay_render_completed / replay_render_started` < 80 % or p95 > 45 s on iOS. The same `timeline.ts` + `drawFrame.ts` run unchanged on the server against `@napi-rs/canvas` — that's the payoff of keeping the renderer DOM-free.

---

## Part C — Phased Cursor Agent prompts

Conventions for all phases: React 18 + Vite + TypeScript strict, Vitest, ESLint/Prettier already configured. No new state libraries. Put everything under `src/features/share/`. Every phase ends with `npm run typecheck && npm run lint && npm run test` green. Don't touch the mission clock or `submit-participant-result`. Commit per phase.

### Phase 1 — Renderer + share card + share sheet

```
You are working in the AMRAP With Friends repo (React 18, Vite, TypeScript strict, Supabase, Vitest).
Goal of this phase: a share card image on the mission result screen, shareable via the OS share sheet.
Do NOT build video yet. Do NOT add any dependencies except `nanoid` if not present.

Context
- The result screen renders after `submit-participant-result` succeeds. Find it (search for "I EARNED THIS").
- Mission, participant and round data are in Supabase tables `missions`, `participants`, `rounds`.
- Design doc: docs/features/share-card-and-replay.md (Parts A and B). Follow the data shape `ReplayData`
  and the module layout in B1 exactly.

Tasks
1. Migration `supabase/migrations/<timestamp>_mission_shares_and_replay_rpc.sql`:
   - table `mission_shares` as specified in B2, with RLS: insert for mission participants/host
     (mirror the auth pattern `submit-participant-result` uses for guests), select public, no client update.
   - RPC `get_mission_replay(p_mission_id uuid) returns jsonb`, security definer, returning `ReplayData`
     (B2). Resolve `displayName` in SQL using `athlete_profiles.share_visibility` (add the column:
     text not null default 'name', check in ('name','initials','hidden')). Compute `rounds[].atSeconds`
     relative to `missions.started_at`, clamped to [0, cap]. Omit `prior` for now (return null).
   - RPC `create_mission_share(p_id text, p_mission_id uuid, p_participant_id uuid, p_kind text,
     p_layout text, p_variant text) returns void`.
2. `src/features/share/replayData.ts` — `fetchReplayData(missionId)` and a zod-free manual validator that
   throws on shape mismatch. Unit test with a fixture.
3. `src/features/share/timeline.ts` — implement only the `freeze` phase for now:
   `frameAt(data, t = cap)` returns a FrameState with bars sorted by (rounds desc, reps desc), ranks,
   `highlight` on `isMe`. Unit test ranking and tie-breaks.
4. `src/features/share/renderer/` — `theme.ts` (AWF palette, type scale 40/56/96/160, safe area 72),
   `layouts/{story,square,landscape}.ts` (positions only), `drawFrame.ts` (Canvas 2D, no DOM, no React).
   Draw the `result` and `squad` variants per A3. Load fonts with `FontFace` and await
   `document.fonts.ready` before first draw. Avatars via `createImageBitmap`, initial-in-circle fallback.
   Free/guest watermark bar in the footer; skip it when `athlete_profiles.tier` is 'pro' or 'coach'
   or the athlete has a `home_coach`.
5. `src/features/share/card/useShareCard.ts` — hook that produces `{ blob, url, isReady }` for a given
   `{ layout, variant }`; renders at 1080 wide; memoize per (layout, variant).
6. `src/features/share/share/shareSheet.ts` — `shareArtifact(file, caption)` per B5, including the
   download + clipboard fallback and a toast. Must be invoked from a click handler.
7. UI: on the result screen add `ShareCardPanel` — live preview (CSS-scaled), ratio toggle
   (9:16 / 1:1 / 16:9), variant toggle (My result / Squad), buttons Share and Copy link.
   Caption template per B5 with the short link `https://amrapwithfriends.com/s/{shareId}`.
   `shareId` = 8-char nanoid (custom alphabet, no ambiguous chars); call `create_mission_share`
   when the panel mounts (fire-and-forget, one retry).
8. Analytics: emit `share_card_rendered`, `share_opened`, `share_completed` through the existing
   Growth Engine event helper (find it; don't create a second one).
9. For AMQAP missions (`missions.kind = 'amqap'`) render the `amqap` variant: no leaderboard,
   flow family + minutes + "quality rounds completed".

Acceptance
- On iOS Safari and Android Chrome: result screen shows the card in < 500 ms; Share opens the OS
  share sheet with the PNG attached; the caption text is included.
- Desktop Chrome: Share downloads the PNG and copies the caption.
- A participant with `share_visibility = 'hidden'` appears as "Athlete N" on another athlete's card.
- Typecheck, lint, tests green. No console errors.

Don't
- Don't render the card with html-to-image / dom-to-image. Canvas 2D only.
- Don't upload anything to Storage in this phase.
```

### Phase 2 — Replay engine + MP4 encoding

```
Continue in AMRAP With Friends. Phase 1 (share card, renderer, mission_shares) is merged.
Goal: "Make replay" on the result screen produces a 20-second MP4 rendered from ReplayData, client-side.

Add dependency: `mp4-muxer` (latest). No others.

Tasks
1. `src/features/share/timeline.ts` — implement the full storyboard from design doc A4:
   cuts `full20` (title 0–2, race 2–8 compressed, finish 8–18 real-time last 10 s, freeze 18–20)
   and `story9`. Mission-time → video-time mapping is piecewise linear. Rank changes ease over 300 ms
   on bar `y`. Round pops produce `flashes` decaying over 500 ms. Pure and deterministic:
   `frameAt(data, t, cut)` must return identical output for identical input. Unit tests:
   clock value at phase boundaries, bar order at the end equals Phase 1 ranking, `cardBlend` is 0
   before freeze and 1 at the end.
2. `drawFrame.ts` — draw the `race` and `finish` phases (horizontal bars with name, rounds+reps,
   rank badge; big clock; highlight on isMe; flash overlay) and crossfade into the card layout using
   `cardBlend`. Keep story safe zones (top 250 px, bottom 300 px) free of the clock and link.
3. `src/features/share/replay/encode.ts` — `detectEncoderPath()` returning 'webcodecs' | 'mediarecorder-mp4'
   | 'mediarecorder-webm' | 'none' per design doc B4. Implement:
   - webcodecs: VideoEncoder avc1.42E01E (fallback 4D401F), 1080×1920@30, ~6 Mbps, keyframe every 60,
     latencyMode 'quality', mux with mp4-muxer to a Blob.
   - mediarecorder: canvas.captureStream(30), real-time playback of frames via rAF, mimeType chosen by
     isTypeSupported.
4. `src/features/share/replay/replay.worker.ts` — runs timeline + drawFrame + webcodecs encoder on an
   OffscreenCanvas. Receives `{ data, cut, layout, avatars: ImageBitmap[] (transfer), fonts }`, posts
   `{type:'progress', frame, total}` and `{type:'done', blob, path}`. Main thread fallback when
   OffscreenCanvas is unavailable: same pipeline in 10-frame requestIdleCallback chunks.
5. `useReplay.ts` — `{ status, progress, blob, start(), cancel() }`. Cancel terminates the worker.
   Cache the last blob per (cut, layout) in a ref.
6. UI: "Make replay" button on ShareCardPanel (hidden when path is 'none'). Progress bar with frame
   count then "Encoding…". When done, swap in a "Share replay" button (user gesture required for
   navigator.share). If the path is 'mediarecorder-webm', label it "Download replay" and show a note that
   WebM can't be uploaded to Instagram from this device. Default cut: `story9` when ≤ 2 participants,
   else `full20`; let the user toggle.
7. Analytics: `replay_render_started`, `replay_render_completed` {durationMs, path, cut}, `replay_cancelled`.
8. Add a dev-only route `/dev/replay/:missionId` that plays the timeline in a <canvas> with a scrubber,
   for tuning the storyboard without encoding.

Acceptance
- iOS Safari 16.4+ and Android Chrome: full20 renders and encodes in < 30 s; the MP4 plays in Photos and
  uploads to an Instagram Story.
- Cancel mid-render leaves no orphaned worker (check with the devtools worker list).
- Unit tests for timeline pass; typecheck/lint green.

Don't
- Don't upload the video anywhere.
- Don't use screen capture APIs (getDisplayMedia) anywhere.
```

### Phase 3 — Share link page, OG image, attribution

```
Continue in AMRAP With Friends. Phases 1–2 merged.
Goal: `amrapwithfriends.com/s/{shareId}` unfurls with the card image, has a join CTA, tracks views, and sets
the coach referral cookie.

Tasks
1. Storage: bucket `mission-shares` (public read). Edge function `upload-share-image` (Deno):
   accepts {shareId, png base64 or multipart}, verifies the caller is the share's participant/host using
   the same guest-session auth as submit-participant-result, size limit 400 KB, writes `{shareId}.png`,
   sets `mission_shares.image_path`. Client: after the card renders in Phase 1's panel, upload
   fire-and-forget with one retry. Encode PNG at 1080 wide; if > 400 KB, re-encode as WebP q=0.85.
2. RPC `increment_share_view(p_share_id text, p_ip_hash text)` with a `share_views` dedupe table
   (share_id, ip_hash, day) so one viewer counts once per day.
3. Vercel Edge Function `api/s/[id].ts` (or `/s/[id]` via vercel.json rewrite): fetch share + mission +
   host summary via a service-role call restricted to this function; respond with HTML containing
   og:title "{displayName} scored {rounds}+{reps} on {workout}", og:image = public storage URL,
   og:description "Join the next mission with @{hostHandle}", twitter:card summary_large_image,
   and a script + meta refresh to the SPA route `/s/{id}` for humans. If the host's tier is 'coach',
   set cookie `awf_ref={hostHandle}; Max-Age=5184000; SameSite=Lax; Path=/`. Call increment_share_view.
   Cache-Control for the image: public, max-age=31536000, immutable.
4. SPA route `/s/:id` — mini landing: the card image, "Join the next mission" (→ `/@{hostHandle}` if
   coach-hosted, else `/create`), "What is AMRAP With Friends?" link. If the share has no image yet,
   render the card client-side from `get_mission_replay` (mission must be public or the viewer a
   participant; otherwise show a generic card).
5. Caption logic (B6): if the sharer has `home_coach`, "with @{homeCoachHandle}" in the caption;
   host handle still drawn on the card.
6. Analytics: `share_link_viewed` {shareId, referrer}, `share_link_joined`.

Acceptance
- Pasting a share link into iMessage, Slack, and X shows the card as the preview image.
- Visiting a coach-hosted share link then signing up attributes the account to that coach (verify the
  existing referral code path reads the cookie).
- Storage never contains video; images ≤ 400 KB.
```

### Phase 4 — Coach branding, PR variant, polish

```
Continue in AMRAP With Friends. Phases 1–3 merged.
Goal: coach-branded artifacts, PR detection, and the "Trained with" badge.

Tasks
1. `athlete_profiles.brand jsonb` for coach-tier users: {primary, accent, avatarUrl}. Settings UI under
   Coach settings with live card preview. Validate contrast (WCAG AA against the card background) on save
   and refuse with a clear message.
2. `get_mission_replay`: return `host.brand` when host tier is coach; return `prior` for the `isMe`
   participant — best previous (rounds, reps) on the same `missions.workout_key`. Add `workout_key`
   (text) to missions if missing: library/Coach WOD id when present, else sha256 of the normalized
   workout jsonb. Backfill existing rows.
3. Renderer: apply `host.brand` via `theme.ts` override for coach-hosted missions. `pr` variant:
   old → new score, "PR" tag; auto-select it when `prior` exists and the new score beats it.
   "Trained with @handle" badge in the host strip when `homeCoachHandle` is set.
4. Host-side: on the host's result screen default to the `squad` variant and add "Share squad board".
   Add "Share" actions to My missions history rows (re-render from stored data; same pipeline).
5. Profile setting UI for `share_visibility` (Name / Initials / Hidden) with a one-line explanation.
   Finish-screen note for guests: "Your name appears on your squad's share cards."
6. Telemetry review: dashboard query (SQL file in supabase/scripts) for render success rate, p95 durations
   by encoder path, share_completed by kind, share_link_viewed → joined conversion.

Acceptance
- A coach-branded mission produces a card in the coach's colors; a bad palette is rejected at save.
- An athlete who beats a prior score on the same workout sees the PR card by default.
- Hidden participants never appear by name anywhere in the pipeline (grep for displayName usage).
```

---

## Open questions for you

1. **Watermark policy** — Pro removes it (as in the business plan). Should Coach-attached *free* athletes also get the clean card? I've assumed yes; it's a cheap incentive to attach.
2. **Public by default?** `/s/` pages expose the squad board. I've assumed missions default to `visibility = 'private'` and the share page shows the full board only to participants, a generic card to everyone else. If you want maximum virality, flip the default to public and let hosts opt out.
3. **Sound** — the replay is silent by design. If coaches ask for a beat, add a royalty-free track picker later rather than baking one in now.
