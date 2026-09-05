# Epic: SEO & AI-Search Roadmap

**Branch:** `claude/amrap-seo-roadmap-xwf1sk`
**Status:** Approved — Astro content site + existing SPA (option A, Part 2)
**Last updated:** 2026-09-01 (Phases 0–3 shipped)

---

## The one-sentence strategy

We cannot win "AMRAP workouts" with the app; we win it with a **content layer the
app does not have yet**, served as **static HTML** — because Google ranks content
and AI assistants cannot see a single word of a client-rendered React SPA.

---

## Current state — the honest baseline

| Area                    | Today                                                                                                     | Verdict                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Rendering               | Astro for `/` and content pages; the SPA keeps its app routes                                             | **Phase 1** — content pages are real HTML. `/` is still the SPA              |
| `<title>` / description | ~~One set, hard-coded, identical on every route~~                                                         | **Fixed in Phase 0** — per-route via `useSeo`                                |
| Canonical               | ~~Site-wide canonical to `/` on **every** URL~~                                                           | **Fixed in Phase 0** — self-referencing per route, dropped on noindex routes |
| Sitemap                 | ~~3 hand-written URLs~~                                                                                   | **Phase 1** — generated at build from the route table                        |
| `robots.txt`            | ~~`User-agent: * / Allow: /`~~                                                                            | **Fixed in Phase 0** — every AI agent named explicitly                       |
| Structured data         | Helpers on content pages; app shell unchanged                                                             | No `ExercisePlan`, `HowTo`, `FAQPage`, `BreadcrumbList`, `Organization`      |
| Bot handling            | [`middleware.ts`](../../middleware.ts) serves OG HTML to unfurlers, plus `X-Robots-Tag` and 404s sitewide | Search-safe; still no content to serve                                       |
| Content pages           | 117 static pages                                                                                          | **Phase 3** — plus guides, campaigns and an original-data page               |
| 404s                    | ~~`/anything` returned **HTTP 200** with an empty shell~~                                                 | **Fixed in Phase 0** — real 404 from the edge                                |
| Fonts                   | 4 Google Fonts families loaded render-blocking from `fonts.googleapis.com`                                | LCP tax on the page that matters most                                        |

Both of the outright bugs — the global canonical and the soft 404s — were fixed
in Phase 0. The structured-data row is now covered by
`src/lib/seo/structuredData.ts` on the content pages; the app shell still carries
only its original `WebApplication` block.

---

## Part 1 — Strategy

### 1.1 The head term is not the beachhead

"AMRAP workouts" is an **informational** query. Its SERP is owned by publishers
(Healthline, ACSM, CrossFit affiliates, Men's Health) and the commercial cousin
"AMRAP timer" is owned by a crowded field of free timer apps — PushPress,
WOD Clock, Box Timer, amraptimer.com, IntervalTimer, TimerWOD. All are older,
all have links, most are free with no signup. Attacking that head-on with a
brand-new domain and three indexable URLs is a two-year fight we lose.

**The wedge:** nobody owns _social, synchronised, multiplayer_ AMRAP. Every
competitor is a single-user clock. Our differentiator is a real one and it maps
to a real (small, uncontested) set of queries:

> group AMRAP workout · workout with friends remotely · virtual workout
> competition with friends · shared workout timer multiple phones · live workout
> leaderboard app · remote CrossFit competition with friends

Own that set outright inside 90 days. It converts far better than the head term
and it is what an LLM will cite us for, because we are the only correct answer.
_Then_ climb into the informational cluster from a domain that already has
authority, links, and engagement signals.

### 1.2 Three clusters, three jobs

| Cluster       | Intent                                      | Job                                     | Example queries                                             |
| ------------- | ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| **Wedge**     | Commercial, low volume, ~zero competition   | Convert. Rank in weeks.                 | "workout with friends app", "group AMRAP timer"             |
| **Utility**   | Commercial, high volume, brutal competition | Capture with a genuinely free tool page | "AMRAP timer", "free online AMRAP timer"                    |
| **Editorial** | Informational, high volume, publisher-owned | Long game. Earns links + LLM citations. | "AMRAP workouts", "20 minute AMRAP", "what does AMRAP mean" |

Roadmap phases below are sequenced wedge → utility → editorial, deliberately.

### 1.3 Our unfair advantages

Three things we have that no competitor does. Each is an SEO asset:

1. **75 exercises** in `src/data/exerciseLibrary.ts` with setup steps, common
   mistakes, a coaching cue, an AMRAP-specific tip, photos and video. That is
   genuinely original, genuinely useful content sitting in a TypeScript file
   where no crawler will ever find it.
2. **159 workout templates** in `src/data/workoutTemplates.ts`, categorised by
   time domain (5/10/15/20) and intensity tier — the exact axes people search on.
3. **Real scoring data.** Once we have volume, we can publish what nobody else
   can: _"median rounds on a 20-minute AMRAP of X"_, PVI pacing distributions,
   what a good score actually is. **Original data is the single strongest
   citation magnet in AI search.** This is the long-term moat; start collecting
   with publication in mind now.

### 1.4 The programmatic-content trap

159 workouts × a template = 159 thin pages = a spam signal and a manual action
risk. **Rule: a page ships only when it has something unique to say.** Minimum
bar per generated page — unique intro, the movement list with our own coaching
notes, scaling guidance, "what's a good score", and a link to run it live.
Ship the 20 strongest, measure, then widen. Never generate the long tail
because we can.

---

## Part 2 — Architecture

### 2.1 The non-negotiable constraint

Most AI crawlers — GPTBot, ClaudeBot, PerplexityBot, Meta-ExternalAgent — **do
not execute JavaScript.** They read the initial HTML response and nothing else.
Googlebot renders JS, but on a delayed second pass and with no guarantee.

For a client-rendered SPA this is not "ranks poorly". To ChatGPT, Claude,
Perplexity and Meta AI, **the site currently has no content at all.** Any
roadmap that does not put real HTML in the first response is decoration.

### 2.2 Options

| Option                                                             | What it is                                                                                 | Pros                                                                                                                                                                                                     | Cons                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Astro content site + existing SPA** _(recommended)_           | Astro owns `/` and all content routes; the Vite SPA keeps its current app routes unchanged | Zero-JS static HTML by default → best possible CWV and crawler legibility; content and app evolve independently; **does not touch** Supabase auth, realtime, or RLS assumptions; standard industry split | Two builds and two dependency trees; design tokens must be shared, not duplicated; the homepage gets rebuilt in Astro                                                                            |
| **B. Migrate to SSR (React Router 7 framework mode, or Next.js)**  | One app, server-rendered                                                                   | One codebase; per-route meta comes free; every page indexable                                                                                                                                            | Touches every page; `persistSession`, the `localStorage` theme script, Realtime subscriptions and the guest/intake gates all assume a browser; highest risk for content we could ship statically |
| **C. Prerender the SPA** (Prerender.io, or extend `middleware.ts`) | Serve HTML snapshots to bots                                                               | Cheapest; the middleware already does a crude version                                                                                                                                                    | Cloaking-adjacent; a snapshot of a page with no content is still a page with no content. **Solves the wrong problem** — our issue is missing content, not missing rendering                      |

### 2.3 Recommendation: A

Astro for content, SPA for app. Reasons, in order:

1. It puts static HTML in front of every crawler, which is the whole ballgame.
2. It leaves the app — the risky, stateful, realtime part — completely alone.
3. Content pages ship zero JS, so Core Web Vitals are excellent by default and
   stay excellent as the content set grows.
4. Astro islands cover the two dynamic bits on the homepage (`FeaturedWodCard`,
   `LiveLeaderboardPreview`): static shell renders instantly, those hydrate.
5. It is common practice, not a novel bet — Astro-for-marketing plus
   SPA-for-product is the default shape for exactly this situation.

**Critical constraint on any option: existing app URLs must not move.** Rally
links (`/rally-point/:id`, `/mission/:id`, `/join`) are shared into group chats
and live in the wild. Astro takes `/` and new content paths; the SPA keeps
everything it has. Vercel routes by path prefix.

**Open decision — the homepage.** It is our single most valuable URL and it is
currently CSR. Under option A, Astro should own it, which means rebuilding
`LandingHero` / `HomeSeoContent` as Astro components against the same
`src/index.css` tokens. That is the largest single chunk of Phase 1 and the main
thing worth debating before we commit.

---

## Part 3 — Site structure

Everything below is new and lives in the content layer. `[bracketed]` segments
are generated from data we already have.

```
/                                  Homepage — wedge positioning, static, islands for live data
/amrap-timer/                      Free timer. No signup. Utility cluster's landing pad.
/amrap-workouts/                   Hub — the head term
  /amrap-workouts/5-minute/          } generated from TIME_DOMAINS
  /amrap-workouts/10-minute/         } each: what it's for, 6-10 workouts, scoring
  /amrap-workouts/15-minute/
  /amrap-workouts/20-minute/
  /amrap-workouts/bodyweight/      } by equipment — the highest-volume modifiers
  /amrap-workouts/dumbbell/
  /amrap-workouts/at-home/
  /amrap-workouts/[workout-slug]/  from workoutTemplates.ts — top 20 first, gated on quality
/exercises/                        Hub
  /exercises/[exercise-slug]/      75 pages from exerciseLibrary.ts — our best raw asset
/guides/
  /guides/what-is-amrap/           definitional — the LLM-citation workhorse
  /guides/amrap-vs-emom-vs-tabata/ comparison — LLMs love a comparison table
  /guides/how-to-score-an-amrap/
  /guides/what-is-a-good-amrap-score/
  /guides/amrap-pacing/            ties to our PVI work — uniquely ours
  /guides/group-workouts-remotely/ the wedge, in editorial form
/campaigns/                        multi-week programming explainer → /campaign/new
/stats/                            original data. Phase 3+. The moat.
/about/  /privacy/  /terms/        trust signals (E-E-A-T); cheap, do them
```

**Indexation policy for existing app routes:**

| Route                                               | Policy            | Why                                                                                |
| --------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `/`, `/create`, `/join`                             | index             | Public entry points                                                                |
| `/rally-point/:id`, `/mission/:id`, `/campaign/:id` | `noindex, follow` | Ephemeral, private, infinite URL space. Keep OG tags — social unfurl still matters |
| `/squad`, `/hud`, `/my-missions`, `/intake`         | `noindex`         | Signed-in surfaces                                                                 |
| `/coach`, `/coach/wods`                             | `noindex`         | Internal tooling                                                                   |
| unknown paths                                       | real **404**      | Kills the soft-404 problem                                                         |

---

## Part 4 — AI search (AEO/GEO)

Ranked by actual impact. Note items 6 and 7 are deliberately marked low-value.

1. **Static HTML.** Item 1 with nothing close behind. See 2.1.
2. **Name the retrieval bots explicitly in `robots.txt`.** `Allow: /` already
   permits them, but explicit groups are the documented control surface and
   protect us against a future default-deny. Distinguish the two kinds:
   - _Retrieval / citation_ — **always allow**: `OAI-SearchBot`, `ChatGPT-User`
     (ChatGPT), `Claude-SearchBot`, `Claude-User` (Claude), `PerplexityBot`,
     `Perplexity-User`, `Applebot` (Siri/Spotlight/Safari suggestions),
     `Bingbot` (feeds Copilot and DuckDuckGo), `Googlebot` (feeds AI Overviews
     and Gemini grounding).
   - _Training_ — `GPTBot`, `ClaudeBot`, `Google-Extended`, `Meta-ExternalAgent`,
     `Applebot-Extended`, `CCBot`, `Bytespider`. **Recommend allowing these
     too.** We are an unknown brand; being in the weights is upside, and the
     content we would be protecting is content we want distributed.
   - **Verify nothing upstream is silently blocking them.** Vercel and
     Cloudflare bot-mitigation defaults have blocked AI agents before. Check
     the logs, don't assume the file is being honoured.
3. **Answer-first content structure.** The extractable unit is a question as an
   `<h2>` with a direct 40–60 word answer immediately beneath it, detail after.
   This single formatting discipline does more for citation rate than any
   markup. Apply it to every `/guides/` page.
4. **Original data** (§1.3.3). What gets us cited rather than merely crawled.
5. **Structured data:** `ExercisePlan` on workout pages, `HowTo` on exercise
   pages, `FAQPage` on guides, `BreadcrumbList` sitewide, `Organization` with
   `sameAs` for entity resolution, keep `WebApplication` on `/`.
6. **`llms.txt` — ship it, expect nothing.** As of Q1 2026 no major provider
   (OpenAI, Google, Anthropic, Meta, Mistral) has committed to reading it in
   production; measured traffic to the file is ~0.1% of AI bot hits, and at
   least one citation model got _more_ accurate with it removed. It is absent
   from Google's own generative-AI guidance. Thirty minutes of work, filed under
   cheap insurance. **Not a workstream.**
7. **Grok / X.** No documented public crawler contract to optimise for. Grok
   grounds heavily in X itself, so the lever is _presence on X_, not markup.
   Treat as off-site (Part 6), not technical.
8. **Off-site is disproportionately powerful for LLMs.** Ask any assistant for
   "best AMRAP timer" and the answer is assembled from listicles and Reddit
   threads, not from vendor sites. Getting into the roundups is simultaneously
   a link-building play and an AEO play. See Part 6.

### Per-surface summary

| Surface                               | How we reach it                                         | Action                                                                                           |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Google Search / AI Overviews / Gemini | Googlebot, `Google-Extended`                            | Classic technical SEO + GSC. Google's guidance is explicit: normal SEO is what feeds AI features |
| ChatGPT Search                        | `OAI-SearchBot`, `ChatGPT-User`, plus the Bing index    | Allow both; register with Bing Webmaster Tools                                                   |
| Claude                                | `Claude-SearchBot`, `Claude-User`, `ClaudeBot`          | Allow all three                                                                                  |
| Perplexity                            | `PerplexityBot`, `Perplexity-User`                      | Allow                                                                                            |
| Meta AI                               | `Meta-ExternalAgent`                                    | Allow                                                                                            |
| Copilot / DuckDuckGo                  | Bing index                                              | Bing Webmaster Tools + **IndexNow**                                                              |
| Safari                                | Google default; Applebot for Siri/Spotlight/suggestions | Allow `Applebot`                                                                                 |
| Firefox                               | Google default                                          | No extra work                                                                                    |
| Grok                                  | X ecosystem                                             | Off-site presence on X                                                                           |

---

## Part 5 — Measurement

Stand this up in Phase 0. We cannot report on what we never baselined.

| Tool                          | Purpose                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Search Console**     | Verify domain property; submit sitemap; watch Coverage for the soft-404 fallout as it clears                                                                                  |
| **Bing Webmaster Tools**      | Feeds Copilot + DuckDuckGo; also gives free IndexNow                                                                                                                          |
| **IndexNow**                  | Ping on deploy. Instant submission to Bing/Yandex/Seznam. Genuine, cheap win                                                                                                  |
| **GA4** (or Plausible)        | Conversion tracking. GA4 needs a consent story; Plausible is lighter if we don't need the depth                                                                               |
| **AI-referral channel group** | GA4 does **not** segment these by default. Build a custom group for `chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`, `x.com/i/grok` |
| **AI bot-hit log**            | Parse Vercel logs for the user agents in Part 4. Proves the crawlers are actually getting in                                                                                  |
| **Rank tracking**             | ~30 terms across the three clusters                                                                                                                                           |
| **LLM citation audit**        | Monthly: run 20 fixed prompts against ChatGPT, Claude, Gemini, Perplexity and Grok; record whether we appear. This is the only real AEO KPI                                   |

**North-star metrics:** non-brand organic sessions → mission created; AI-referred
sessions; LLM citation rate on the 20 audit prompts.

---

## Part 6 — Off-site

Links and mentions are the constraint on the editorial cluster, and the primary
input to LLM answers about "best" anything.

- **Roundup placement.** "Best AMRAP timer apps" listicles are what LLMs
  synthesise. Pitch to be included. Highest leverage item here.
- **Reddit** — r/crossfit, r/homegym, r/bodyweightfitness. Participate honestly;
  these threads are heavily weighted in AI answers. Do not astroturf; it is both
  wrong and detectable.
- **YouTube** — a workout running live on the synced timer is a better demo than
  any screenshot, and YouTube is its own search engine.
- **The data page** (§1.3.3) is the link-earning asset. Pitch it to fitness
  press once there is enough volume for the numbers to be honest.
- **X** — the only real lever on Grok.

---

## Part 7 — Phased roadmap

### Phase 0 — Stop the bleeding _(week 1, no framework work)_ — **shipped, partly**

**Done in code:**

- [x] Global canonical removed from `index.html`; per-route canonicals from
      [`src/lib/seo/routes.ts`](../../src/lib/seo/routes.ts)
- [x] Catch-all route + a real 404 status. `middleware.ts` answers unknown paths
      with HTTP 404 before the rewrite runs; `NotFoundPage` covers client-side
      navigation and local dev, which never reach the server
- [x] `robots.txt`: explicit AI agent groups (Part 4.2)
- [x] App surfaces `noindex`ed, via the `X-Robots-Tag` header rather than a meta
      tag — authoritative for crawlers that never render
- [x] IndexNow key file + `npm run seo:indexnow`
- [x] `middleware.ts` is now typechecked (`tsconfig.node.json`) and unit tested

**One source of truth.** `src/lib/seo/routes.ts` is read by both the SPA
(`useSeo`) and the edge middleware, so a route's title, canonical and index
policy cannot disagree between what a browser sees and what a crawler sees.
`sitemap.test.ts` fails CI if `public/sitemap.xml` drifts from the indexable set.

**Needs a human with account access:**

- [ ] Verify Google Search Console; submit the sitemap
- [ ] Verify Bing Webmaster Tools (feeds Copilot + DuckDuckGo)
- [ ] Wire `npm run seo:indexnow` to a Vercel post-deploy hook
- [ ] Confirm no CDN- or platform-level bot blocking of the AI agents in Part 4
- [ ] Watch GSC Coverage as the soft-404 backlog clears

**Blocked / deferred:**

- [ ] Analytics + AI-referral channel group — blocked on open question 4 (GA4 vs
      Plausible). Note `src/lib/analytics/` already writes product events to
      Supabase; the gap is _acquisition_ analytics, not product analytics
- [ ] Self-host the four font families — the sandbox that did this work cannot
      reach `fonts.googleapis.com`, so the files could not be fetched. Unchanged
      for now: Bebas Neue 400, Work Sans 400/600/700, Rubik 700, DM Sans
      400/600/700, latin subset. Load exactly those weights when self-hosting —
      `.home-marketing .text-display` asks for `font-extrabold` against a Rubik
      700 file today, so adding a 800 file would change how the page looks
- [ ] `scripts/` is still outside typechecking: two scripts have pre-existing
      Supabase generic errors. Worth fixing separately

_Exit criteria: no self-inflicted penalties, and we can measure._ Code half met;
the measurement half needs the account work above.

### Phase 1 — Content layer _(weeks 2–4)_ — **shipped**

Architecture decision taken: **option A, Astro content site + existing SPA.**

**Done:**

- [x] Astro in the repo (`astro.config.mjs`, `site/`), single package so there is
      one dependency tree and one Tailwind config
- [x] Two builds, one output. Vite → `dist-app`, Astro → `dist-site`,
      `scripts/merge-build.ts` assembles `dist/`. The SPA's entry HTML lands at
      `_app-shell/index.html` and `vercel.json` rewrites app routes to it, so
      **no existing app URL moved**
- [x] Shared design tokens — the Astro layout imports `src/index.css` and
      Tailwind runs through the repo's existing postcss config. Nothing duplicated
- [x] Per-page title/description/canonical/OG, resolved by the layout from
      `src/lib/seo/routes.ts` — the same table the SPA and the middleware read
- [x] Generated `sitemap.xml` and `llms.txt` (build step, from that table).
      `public/sitemap.xml` is deleted: a hand-written sitemap drifts silently
- [x] Structured data helpers — Organization, WebApplication, BreadcrumbList,
      FAQPage, with JSON-LD escaping
- [x] `/amrap-timer/` — free, no signup, static, answer-first FAQ. The timer is
      the only thing on the page that ships JavaScript, hydrated as one island
- [x] `/about/`, `/privacy/`, `/terms/`
- [x] `npm run build` added to CI — type errors inside `.astro` frontmatter only
      surface at build time

**Verified in the build output:** every content page emits its own title,
description, canonical and robots; `/about` ships zero JavaScript; the CSS bundle
carries the shared `--color-*` tokens.

- [x] Homepage moves to Astro, with islands for the auth and data panels

**Needs a human:** `/privacy` and `/terms` describe what the app actually does
and are accurate, but they have not had legal review. They are drafts.

### How the homepage moved

Option A was taken. The problem was that every dynamic component on `/` navigates
with react-router `<Link>`, and an Astro island has no Router — a `<Link>` there
throws, and a `<Link to="/">` from inside the SPA would push a history entry the
SPA can no longer render, because Astro owns `/` now.

[`AppLink`](../../src/components/AppLink.tsx) resolves both with one rule: render
a `<Link>` only when we are inside a Router **and** `isAppRoute(to)` says the SPA
serves the target. Everything else is a real anchor. So an island link works, and
so does a link back to a content page from deep inside the app.

`linkTargets.test.ts` fails CI if any `<Link>` in `src/` points at a page Astro
builds — the failure mode is otherwise silent, and it will recur every time
Phase 2 adds content routes.

What this cost: a signed-in athlete clicking a link back to `/` from inside the
app gets a full page load rather than a client-side transition. Nothing was
removed — scheduled missions and campaigns still render on the home page, as
`client:only` islands, because they mount `ThemeProvider`, which reads `document`.

The SPA's `HomePage`, `LandingHero`, `RallyCta` and `HomeSeoContent` are deleted.
Keeping them would have meant two homepages drifting apart.

**Result:** `/` now serves about 4.5 KB of real text before any JavaScript runs —
the h1, the AMRAP definition, seven `<h2>`s, the workout style names and an
answer-first FAQ with matching `FAQPage` markup. An AI crawler previously saw
none of it.

### Phase 2 — Programmatic content _(weeks 4–8)_ — **shipped**

- [x] `/exercises` + 69 movement pages (`HowTo` schema)
- [x] `/amrap-workouts` hub, 4 duration pages, 7 training-stimulus pages
- [x] 20 workout pages (`ExercisePlan` schema), nested under their duration
- [x] Internal linking: workout ↔ exercise ↔ collection ↔ "run this live"
- [x] A real `/404` page, now that `vercel.json` no longer rewrites everything

**108 pages built, 109 URLs in the sitemap** (the extra is the SPA's `/create`,
served by a rewrite rather than a file). Every page carries its own title,
description, canonical and schema, and ships **zero JavaScript**. Measured text
per page: ~1,750 characters on a movement or workout page, ~3,500–4,000 on a
collection page.

**The quality gate is real, not decorative.** `hasEnoughToSay` publishes a
movement only when it has setup text, a coaching cue, an AMRAP-specific tip, and
at least one workout that programmes it — 69 of 73 pass, 4 do not. Workout pages
require two or more movements, a tactical note, a category, and a library entry
for every movement, so the page can actually explain the workout it describes.

**Twenty workouts, spread rather than skimmed.** `featuredWorkouts` buckets the
150 templates by duration × category and takes one from each in turn, so the
published set covers all four time domains and all seven stimuli instead of
twenty variations on the same five-minute sprint. Benchmarks sort first within
their bucket. It is deterministic and asserted as such.

**URL shape.** Workouts nest under their duration —
`/amrap-workouts/5-minute/flash-flood` — which gives clean breadcrumbs and avoids
a collision between `[duration]` and `[slug]` at the same level. Styles live
under `/amrap-workouts/style/…` for the same reason. Slugs are the existing data
ids, which for benchmarks are the one thing that must never change.

**How 100 generated pages stay out of the middleware.** `contentPages.ts` reads
the exercise library and the workout templates — far too much to bundle into the
edge. `DYNAMIC_CONTENT_ROUTES` carries three patterns instead; an unknown slug
matches a pattern, passes through, and Vercel answers with a real 404 because no
file was built for it. The sitemap gets the exhaustive list, because it is
generated in Node at build time.

**A sitemap that lists an unbuilt URL is a pile of soft 404s handed to Google**,
so `merge-build.ts` now fails the build if any sitemap URL has no corresponding
file. Verified against a deliberately broken route, not just assumed.

#### The content gap worth fixing first

**72 of the 73 exercises have an empty `commonMistakes` array.** Only `burpees`
is filled in. The page template renders the section whenever it is populated, so
this is pure content entry with no engineering attached — and it is the single
highest-leverage improvement available, because "common mistakes" is exactly the
shape of question people ask an assistant about a movement.

Two smaller ones: no exercise has a `videoUrl`, and the photos in the library
live in a Supabase Storage bucket, so the static pages do not yet show them —
worth wiring up, since a movement page without an image is weaker than one with.

### Phase 3 — Editorial & authority _(weeks 8–16)_ — **shipped, except outreach**

- [x] The `/guides/` set, answer-first throughout — six guides plus a hub
- [x] `/campaigns/`
- [x] `/stats/` — first original-data publication
- [ ] Roundup and press outreach — not a code task; see Part 6
- [ ] Widen workout pages beyond the first 20, once Phase 2's prove out in GSC

**117 pages now, 118 sitemap URLs.** Guides run 3,400–3,600 characters each;
`/campaigns` 3,100; `/stats` 2,400.

**Answer-first is enforced by the layout, not by discipline.** `GuideLayout`
takes an `answer` prop — the direct answer in 40–60 words, rendered above the
fold before any detail — and an `faqs` array that becomes _both_ the visible
copy and the `FAQPage` markup. Markup that does not match what a reader sees is
a spam signal, so the two are built from one source and cannot drift.

**The pacing guide publishes something nobody else has.** The Pace Variance
Index — `(slowest round − fastest round) ÷ average round × 100` — with its four
bands, straight out of `getPviMultiplier`. A specific, named, reproducible
metric is exactly the shape of thing an assistant quotes, and it is ours.

#### `/stats` publishes what is honest today

The roadmap wanted athlete-side data: median rounds on a workout, the
distribution of pacing scores, typical improvement across a campaign. **We do not
have the volume for those numbers to be honest, and inventing them would be worse
than not publishing.** So `/stats` publishes what is real right now — how the
library itself is built, computed at build time from the templates:

- Round density scales with the cap: 2.1 movements and 27 reps per round at 5
  minutes, 4.0 movements and 60 reps at 20 minutes
- Air squats appear in 16.7% of all workouts, more than any other movement
- 20 of the 73 movements appear in exactly one workout; the median movement is
  used in 4

The page says plainly what is missing and why, and commits to publishing it when
the numbers are real. That section is the one to delete first once there is
volume.

#### What the first GSC impressions say

Five impressions, zero clicks, on `amrap workouts`, `bodyweight amrap` and
`amrap exercise`. **That is confirmation of indexing, not a signal about
ranking** — five impressions is noise, and drawing conclusions from it would be
a mistake. What is worth noting is that all three are informational head terms
and all three now have a page aimed squarely at them: `/amrap-workouts` leads on
"bodyweight", `/exercises` on "amrap exercise", `/guides/what-is-amrap` on the
definitional query. Re-read the query report in four to six weeks, when there is
enough data to mean something.

### Phase 4 — Compounding _(ongoing)_

- [ ] Monthly LLM citation audit
- [ ] Quarterly content refresh on decaying pages
- [ ] Link building
- [ ] Expand programmatic sets where the data justifies it

---

## Open questions for discussion

1. **Architecture** — Astro + SPA (recommended), full SSR migration, or
   prerendering? Everything in Phase 1+ hangs off this.
2. **Homepage ownership** — does Astro take `/`? It is the highest-value URL and
   the largest chunk of Phase 1 work.
3. **Training crawlers** — allow (recommended, we want the distribution) or
   block?
4. **Analytics** — GA4 (depth, consent burden) or Plausible (light, privacy-clean)?
5. **Content capacity** — Phase 3 is editorial. Who writes it? That, not
   engineering, is the realistic bottleneck on the head term.
