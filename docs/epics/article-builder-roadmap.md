# Epic: Article Builder (coach)

**Branch:** `claude/blog-strategy` (strategy); implementation branch TBD  
**Status:** Draft for discussion  
**Last updated:** 2026-09-05  
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

| Path                         | Job                                     |
| ---------------------------- | --------------------------------------- |
| `/coach/articles`            | List drafts, scheduled, published       |
| `/coach/articles/new`        | Create draft                            |
| `/coach/articles/:articleId` | Edit draft / refresh published snapshot |

Add rows to `APP_ROUTES` and `vercel.json` rewrites to `/_app-shell`, matching
`/coach/wods`.

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

**Data (sketch):** `coach_articles` (or `blog_articles`) via SECURITY DEFINER
RPCs only — same posture as coach WODs. Fields cover the taxonomy table above;
body as Markdown text for v1.

**UI:** List (filter by status/category) · New · Edit form with answer-first +
body + metadata · Save draft · Mark ready (runs soft validation, does not
publish).

**Done when:** A coach can create and edit a full draft that serializes to the
frontmatter shape the Astro collection will expect, without uploading media yet.

### Phase 2 — Photos

**Reuse:** Coach media upload patterns (`coach-exercise-media` ownership model
as a template; prefer a dedicated `blog-media` or `coach-article-media` bucket
with `{auth.uid()}/…` prefixes and coach-only write policies).

**UI:** Attach 1–N images, require alt, optional caption; reorder; preview.

**Publish path:** Public URLs must be stable for Astro builds (same lesson as
exercise media: either commit resolved URLs into the exported MD, or a
manifest). Do **not** rely on browser extension fallbacks on static pages.

**Done when:** A draft can include images with alt text, and the export format
references real public URLs.

### Phase 3 — Quality gates (soft → hard)

Wire strategy gates into “Mark ready” / “Publish”:

| Gate                             | Ready     | Publish |
| -------------------------------- | --------- | ------- |
| Title, slug, category, archetype | Soft warn | Hard    |
| Answer-first 40–60 words         | Soft warn | Hard    |
| Description 50–160 chars         | Soft warn | Hard    |
| Cannibalisation + pillar         | Soft warn | Hard    |
| ≥2 library links                 | Soft warn | Hard    |
| Every image has alt              | Soft warn | Hard    |
| Author set                       | Soft warn | Hard    |

Unit-test pure validators in `src/lib/seo/` or `src/lib/coach/articles/` (repo
convention: logic beside tests, not only in components).

**Done when:** CI tests lock the validators; UI blocks publish on hard failures.

### Phase 4 — Publish into Astro

This is the load-bearing phase. Strategy wants **content collections**
(`site/content/blog/*.md`) and offline builds.

**Recommended v1 pipeline:**

1. Coach clicks **Publish** → RPC stamps `publishedAt` / `modifiedAt`, status
   `published`, stores an immutable **export snapshot** (MD + frontmatter +
   image URLs).
2. CI or a `npm run seo:pull-articles` script (coach/service role, network)
   writes/updates files under `site/content/blog/`.
3. Normal `build` + `merge-build` + sitemap checks pick them up.
4. `BlogPosting` JSON-LD uses snapshot dates, never `Date.now()`.

**Alternatives (decide before Phase 4 build):**

| Option                                  | Pros                               | Cons                                             |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| A. Export script → committed MD (above) | Matches strategy; reviewable diffs | Needs a human or bot commit                      |
| B. Build-time fetch from Supabase       | No commit step                     | Couples Vercel build to DB; weaker offline story |
| C. Edge-render posts                    | Fast iteration                     | Fights the static/AI-HTML strategy               |

**Default: A.** Same philosophy as `seo:resolve-exercise-media`.

Also in Phase 4: `/blog` index, `/blog/[slug]`, RSS, route table,
`generate-og-images` title extension, nav link — as specified in blog-strategy
Technical architecture. Category index pages only when count ≥ 3.

**Done when:** Publishing a post in Article Builder results in a static `/blog/{slug}`
page in production after the export + deploy path, with correct canonical,
OG, and `dateModified`.

### Phase 5 — Cadence tooling (thin)

Not a second product — just coach affordances for the strategy cadence:

- **Refresh queue** list: posts with `modifiedAt` older than N months; page-2
  GSC hooks later (manual CSV upload ok at first).
- **First-twelve checklist** seeded as suggested drafts (titles from
  blog-strategy), not auto-written bodies.
- Counter: published this month / refreshes this month (informational).

**Done when:** A coach can see what to write or refresh next without leaving
`/coach/articles`.

---

## Mapping to the first twelve posts

Article Builder does not invent the editorial calendar; it **loads the strategy
list** as suggested starters (category + archetype pre-filled, empty body):

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

## Open questions

1. **Publish path A vs B** — confirm committed MD export (recommended) vs
   build-time Supabase fetch.
2. **Who is `author`?** — single coach profile vs selectable staff bios (blocks
   E-E-A-T).
3. **Body editor** — Markdown textarea v1 vs block editor later.
4. **Multi-coach drafts** — shared queue or owner-only until published.
5. **Start Article Builder before `/blog` Astro shell exists?** — Phase 0–3 can
   ship behind the coach gate; Phase 4 needs the public blog routes.

---

## Suggested sequencing

```
Phase 0  shell + /coach card
   ↓
Phase 1  drafts + copy + metadata
   ↓
Phase 2  photos + alt
   ↓
Phase 3  hard quality gates
   ↓
Phase 4  Astro /blog + export/publish pipeline   ← public SEO value
   ↓
Phase 5  refresh queue + first-twelve starters
```

Do not open Phase 4 until Phases 1–3 make a post that would already pass the
strategy checklist on paper. Do not point coaches at a publish button that
writes thin posts into the sitemap.
