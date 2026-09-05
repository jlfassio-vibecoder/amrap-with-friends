# Epic: Article Builder (coach)

**Branch:** `claude/blog-strategy` (strategy); implementation branch TBD  
**Status:** Draft for discussion  
**Last updated:** 2026-09-05 (Phase 5 shipped)  
**Depends on:** [blog-strategy.md](blog-strategy.md), [seo-roadmap.md](seo-roadmap.md)  
**Surfaces:** `/coach` (entry card), `/coach/articles` (builder) — both `noindex`

---

## One-sentence job

Give coaches a **WOD Builder–shaped tool** to draft SEO-friendly blog posts
(copy + photos + structured metadata) that satisfy
[blog-strategy.md](blog-strategy.md), then publish into the Astro content layer
without fighting the evergreen pages.

---

## Why this exists

[blog-strategy.md](blog-strategy.md) defines _what_ to publish and _why_ (AI
freshness, cannibalisation rule, categories, archetypes, answer-first). It does
not give a workflow. Today the only path is hand-editing
`site/content/blog/*.md` in a PR — fine for engineers, wrong for coaches.

The WOD Builder already proves the pattern: coach-only SPA tooling, RPC + RLS,
media upload, list → edit → publish. **Article Builder is that pattern for
posts.**

---

## Non-goals

- A public CMS for athletes or guests.
- Auto-generating posts from LLMs without a human editor (authorship is a
  strategy requirement).
- Competing with `/guides`, `/amrap-workouts`, `/exercises`, or `/stats` —
  the builder must make cannibalisation hard, not easy.
- Shipping thin posts to hit a cadence number. Missing a slot beats filler
  (Helpful Content is sitewide).

---

## Product placement

### `/coach` hub

Immediately **below** the WOD Builder card, same card pattern:

| Field | Copy                                                             |
| ----- | ---------------------------------------------------------------- |
| Title | Article Builder                                                  |
| Blurb | Draft blog posts with copy and photos for the SEO content layer. |
| CTA   | Open Article Builder → `/coach/articles`                         |

`WOD` stays coach jargon; **Article** / **post** on this surface (athletes see
**Blog** on the public site).

### Routes (all `index: false`)

| Path              | Job                                                                    |
| ----------------- | ---------------------------------------------------------------------- |
| `/coach/articles` | List + in-page new/edit (same pattern as WOD Builder — no nested URLs) |

Phase 0 shipped the list shell on this single route. Nested `/new` and
`/:articleId` paths were sketched earlier but Phase 1 kept in-page
`list | new | edit` state instead — do not add those routes without updating
this table.

Add the `/coach/articles` row to `APP_ROUTES` and `vercel.json` rewrites to
`/_app-shell`, matching `/coach/wods`.

---

## Strategy constraints the builder must enforce

These are not nice-to-haves — they are the acceptance criteria from
blog-strategy.

### 1. Cannibalisation gate (hard)

Before a post can leave `draft`, the coach must confirm:

> This would make an existing page worse if merged into it.

Required fields:

- **Pillar link** (required): one of `/amrap-workouts`, `/exercises`,
  `/guides/...`, `/campaigns`, `/stats`, `/create`, etc.
- **Why not a page edit** (required short prose): one or two sentences.
- Optional **related evergreen URLs** for the editor to double-check.

If the answer is “it belongs in a guide,” the builder should refuse publish and
point at editing the evergreen page instead (link out; do not invent a CMS for
guides in v1).

### 2. Taxonomy (frontmatter)

| Field          | Values / rules                                                                |
| -------------- | ----------------------------------------------------------------------------- |
| `title`        | Required                                                                      |
| `slug`         | Flat `/blog/{slug}` — no dates in the path                                    |
| `category`     | One of: Programming, Movement, Pacing & scoring, Training together, The data  |
| `archetype`    | Data story · Specific scenario · Seasonal / timely · Opinion / POV · Teardown |
| `answerFirst`  | 40–60 words; rendered above the body (same discipline as `GuideLayout`)       |
| `description`  | Meta description, 50–160 chars (existing SEO band)                            |
| `author`       | Real person id / display name (stable author entity)                          |
| `status`       | `draft` · `ready` · `published` · `archived`                                  |
| `publishedAt`  | Set on first publish; never from build clock                                  |
| `modifiedAt`   | Set on meaningful refresh; drives `dateModified` in JSON-LD                   |
| `pillarPath`   | Required internal link target                                                 |
| `libraryLinks` | ≥2 paths into workouts/exercises (validated against known routes)             |
| `relatedPosts` | 0–2 other post slugs when they exist                                          |

Category **hub pages** still wait until three published posts (strategy rule) —
the builder can show a counter (“Training together: 1/3 toward category page”).

### 3. Answer-first body

Editor layout:

1. **Answer-first** field (character count 40–60 words, soft warn outside band).
2. **Body** (Markdown or structured blocks — see Phase 1).
3. **Photos** with alt text (required for each image; instructional content).

### 4. Internal links checklist (publish blocker)

Must be true to publish:

- [ ] Links **up** to the pillar
- [ ] Links **down** to ≥2 library pages
- [ ] Links **across** to related posts when the archive has them (soft until ≥3 posts exist)

### 5. Refresh vs new

Posts support **refresh**: edit body/media, bump `modifiedAt`, keep slug and
`publishedAt`. Touching the date without a real change is not offered as a
button.

---

## Phases

### Phase 0 — Shell and placement

**Status: shipped.** Coach hub card + empty `/coach/articles` list (coach-gated
like WOD Builder) + route/SEO/vercel wiring (`noindex`).

**Done when:** A coach sees Article Builder under WOD Builder and can open a
blank list page.

### Phase 1 — Draft model + copy editor

**Status: shipped.** `coach_articles` + list/get/upsert/set_status RPCs;
in-page list/new/edit on `/coach/articles` (not nested routes); Markdown body;
`draft` ↔ `ready` only (no publish); soft validators on Mark ready; empty
`photos` jsonb reserved for Phase 2.

**Done when:** A coach can create and edit a full draft that serializes to the
frontmatter shape the Astro collection will expect, without uploading media yet.

### Phase 2 — Photos

**Status: shipped.** Dedicated `coach-article-media` bucket (public read, owner-folder
writes); `{path, alt, caption?}` on `coach_articles.photos`; upload + reorder +
preview in Article Builder; soft alt warnings on Mark ready; frontmatter serialize
emits public `src` URLs for the export snapshot.

**Done when:** A draft can include images with alt text, and the export format
references real public URLs.

### Phase 3 — Quality gates (soft → hard)

**Status: shipped.** Shared `articleQualityGates` power soft Mark ready warnings and
hard Publish blocks; demote via `coach_set_article_status`; Publish uses
`coach_publish_article` (Phase 4) with hard validation in the UI.

**Done when:** CI tests lock the validators; UI blocks publish on hard failures.

### Phase 4 — Publish into Astro

**Status: shipped.** Option A only: Publish stores an immutable `export_snapshot`
via `coach_publish_article`; `npm run seo:pull-articles` (service role) writes
`site/content/blog/*.md` (+ OG cards under `public/og/blog/`), prunes orphans,
and humans commit the diff. Astro builds `/blog`, `/blog/[slug]`, `/blog/rss.xml`,
and `/blog/category/[id]` only when a category has ≥3 published posts. Sitemap,
nav, `BlogPosting` JSON-LD, and titled OG cards all read committed file dates —
never `Date.now()` at build.

**Loop:** Publish in Article Builder → `npm run seo:pull-articles` → commit → deploy.

**Done when:** Publishing a post in Article Builder results in a static `/blog/{slug}`
page in production after the export + deploy path, with correct canonical,
OG, and `dateModified`.

### Phase 5 — Cadence tooling (thin)

**Status: shipped.** On `/coach/articles` list mode: informational counters
(published / refreshes this month), a **Write next** checklist seeded from all
**24** titles in [blog-authoring.md](blog-authoring.md) (category + archetype +
Justin Fassio byline prefilled; empty body), and a **Refresh queue** for
published posts with `modifiedAt` (or `publishedAt`) older than **3 months**.
Starters do not auto-insert DB rows. GSC page-2 hooks remain later.

**Done when:** A coach can see what to write or refresh next without leaving
`/coach/articles`.

---

## Mapping to the editorial calendar

Article Builder does not invent the editorial calendar; it **loads**
[blog-authoring.md](blog-authoring.md) as suggested starters (category +
archetype pre-filled, empty body). The twenty-four briefs and twelve-month
schedule there are the source of truth — including seasonal reorder and titles
tightened for search-result length.

Author byline for starters: **Justin Fassio**. A drafting model must never invent
a first-person claim under that byline — placeholders only.

Snapshot of an older twelve-post ordering (superseded — do not seed from this):

1. What 150 AMRAP workouts taught us… — The data / Data story
2. The 12-minute AMRAP… — Programming / Scenario
3. How to run an AMRAP with a friend in another time zone — Training together / Scenario
4. Why we refuse to tell you what a good AMRAP score is — Pacing & scoring / Opinion
5. Hotel-room AMRAPs… — Programming / Scenario
6. Air squats are in one in six… — Movement / Teardown
7. Building an eight-week campaign… — Training together / Teardown
8. The first ninety seconds… — Pacing & scoring / Teardown
9. AMRAP workouts for two people… — Training together / Scenario
10. January: how to restart… — Programming / Seasonal
11. The case against the live leaderboard — Training together / Opinion
12. Push-up variations ranked… — Movement / Teardown

Over-invest UI hint on **Training together** suggestions (strategy wedge).

---

## Security and access

- Same gate as WOD Builder: `is_coach()` on every RPC; tables revoked from
  `anon`/`authenticated` direct access.
- Media: coach-owned prefixes; public read only for objects referenced by
  **published** exports (or public bucket with unguessable paths — decide in
  Phase 2 design).
- `/coach/articles*` always `noindex`.

---

## Measurement (product hooks)

When a published post ships, emit a stable `article_slug` (or path) into
analytics so blog-strategy KPIs work:

- Missions created after landing on `/blog/...` (primary conversion).
- Post path available for the monthly LLM citation audit.

Implementation detail can follow existing analytics event patterns; do not block
Phase 1–3 on perfect attribution.

---

## Freshness: when `modifiedAt` advances

`dateModified` is what a search engine's freshness signal reads, and AI
assistants weight recency heavily, so it only means something if it is true.

The publish path used to set it to `now()` unconditionally, in both the client
snapshot and the `modified_at` column. Re-publishing an article nobody had
edited claimed an update, which broke two things: the post showed an "Updated"
line and a fresh `dateModified` it had not earned, and the refresh queue counted
the no-op as a refresh — resetting the staleness clock on a post nobody had
improved, so it dropped out of the queue.

Now, in both layers:

- `buildArticleExportSnapshot` fingerprints the content-bearing fields — title,
  slug, category, archetype, answer-first, description, author, pillar, links,
  related posts, photos and body — and keeps the previous `modifiedAt` when the
  fingerprint matches. `publishedAt` and `modifiedAt` are excluded by
  construction, since they are what the comparison decides.
- The previous value is read **from the previous snapshot, not the column.** The
  column records when a publish last ran, so reading it there would let a chain
  of no-op republishes walk the date forward one publish at a time.
- `coach_publish_article` applies the same rule in SQL, comparing
  `export_snapshot - 'modifiedAt'` against the incoming snapshot, so the column
  the refresh queue reads stays honest too.

An unreadable previous snapshot counts as changed: bumping unnecessarily is a
smaller error than silently withholding a real update.

---

## Open questions

1. **Who is `author`?** — **Settled: Justin Fassio.** Certified Master Fitness
   Trainer and Commander's Total Fitness Program Manager (1998), owner of San
   Diego Core Fitness, co-founder of gymgo and aiworkoutgenerator.com. The
   free-text display name shipped is fine for now; the outstanding work is an
   indexable `/authors/justin-fassio` page with `Person` schema and `sameAs`
   corroboration, referenced as `founder` from the `Organization` node. See
   [blog-authoring.md](blog-authoring.md).
2. **Body editor** — Markdown textarea v1 vs block editor later.
3. **Multi-coach drafts** — shared queue or owner-only until published.

Publish path A (committed MD via `seo:pull-articles`) is locked; build-time
Supabase fetch and edge-rendered posts are out of scope.

---

## Suggested sequencing

```
Phase 0  shell + /coach card                         ✓
   ↓
Phase 1  drafts + copy + metadata                    ✓
   ↓
Phase 2  photos + alt                               ✓
   ↓
Phase 3  hard quality gates                          ✓
   ↓
Phase 4  Astro /blog + export/publish pipeline       ✓
   ↓
Phase 5  refresh queue + authoring starters          ✓
```

Do not point coaches at a publish button that writes thin posts into the sitemap
without the hard gates (Phase 3) and the pull → commit → deploy loop (Phase 4).
