# Epic: Blog strategy

**Branch:** `claude/blog-strategy`
**Status:** Draft for discussion
**Last updated:** 2026-09-01

Follows [the SEO roadmap](seo-roadmap.md). Phases 0–3 built 117 static pages;
this is about what a blog adds that those pages structurally cannot.

---

## The one thing a blog is for here

We already rank-or-will-rank for the evergreen questions. `/guides` answers the
definitional queries, `/amrap-workouts` and `/exercises` cover the library,
`/stats` carries the original data. **A blog that writes "What is an AMRAP?"
competes with a page we already published and makes both worse.**

So the blog needs a job those pages cannot do. It has one, and it is bigger than
it looks:

> **AI assistants weight recency heavily, and our whole content layer is
> permanently dated the moment it ships.**

The measured picture in 2026: roughly half of AI-cited content is under 13 weeks
old, content under 30 days old earns around 3.2× more citations, and the median
citation half-life is about 4.5 weeks. Perplexity and Grok weight freshness most
heavily; Google's AI surfaces are the most conservative. Freshness acts as a
**filter** — on a time-sensitive query, a stale page is cut from consideration
before quality is even assessed.

A static library of 117 evergreen pages cannot pass that filter on its own. A
blog is the mechanism that keeps the domain producing recent, crawlable,
citable material — and that lifts the whole site, not just the posts.

**That reframes the usual advice.** The point is not "publish often for Google."
Google has explicitly downplayed publishing frequency as a ranking signal, and
the Helpful Content system now runs continuously and sitewide — a pile of thin
posts is a liability there, not an asset. The point is that AI search has a
recency filter Google does not, and the blog is how we keep passing it.

### The cannibalisation rule

> **A post ships only if it would make an existing page worse to include.**

If the content belongs in `/guides/amrap-pacing`, it goes in
`/guides/amrap-pacing`. Improving an evergreen page is almost always worth more
than a new post, because the evergreen page already has internal links and
whatever authority it has accrued. The blog takes what genuinely does not fit:
timely, specific, narrative, or opinionated.

---

## Cadence

**Two posts a month, plus two refreshes a month.** Both halves matter, and the
second is the one everybody skips.

|               | Volume    | Why                                                                                                                                               |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New posts** | 2 / month | Enough to keep something under 30 days old at all times, which is the freshness threshold that matters. Sustainable for a small team indefinitely |
| **Refreshes** | 2 / month | Freshness is a position you re-earn, not a status you hold. A meaningfully updated page is fresh again                                            |

**Consistency beats volume, and stopping is worse than never starting.** Four
posts a month for three months then silence is a worse outcome than two a month
forever: the archive goes stale all at once and the site reads as abandoned.
Pick the cadence you will still be running in a year.

**The quality gate applies to posts as it does to pages.** `hasEnoughToSay`
gates a movement page on having something to say; a post gets the same
treatment editorially. Missing a slot is allowed. Shipping filler to hit a
number is not — that is precisely what the Helpful Content system is built to
find.

### The refresh queue

Refreshes are scheduled, not opportunistic. Priority order:

1. **Anything with a number in it.** `/stats` above all — the moment there is
   real athlete data, that page changes and becomes newly citable. Statistics
   and comparison content wants a refresh every 3–6 months.
2. **Posts that rank on page 2.** Cheapest wins available: they already have
   signals, they need depth.
3. **Evergreen guides**, on an annual audit.
4. **Anything a product change has made wrong.** A page describing a flow that
   no longer exists is worse than no page.

A refresh means adding or changing something real. Touching the date on an
unchanged page is a trick that does not work and reads as one.

---

## Categories

Five, mapped onto the taxonomy the site already has, so the blog reinforces the
existing clusters rather than building a parallel structure that competes.

| Category              | Job                                          | Points at                                               |
| --------------------- | -------------------------------------------- | ------------------------------------------------------- |
| **Programming**       | How to build and choose AMRAP workouts       | `/amrap-workouts`, duration and style pages             |
| **Movement**          | Technique, scaling, progressions             | `/exercises`                                            |
| **Pacing & scoring**  | Reading your own numbers                     | `/guides/amrap-pacing`, `/guides/how-to-score-an-amrap` |
| **Training together** | The wedge: groups, remote, squads, campaigns | `/campaigns`, `/create`                                 |
| **The data**          | What we can see across recorded missions     | `/stats`                                                |

**A category page is not created until it has three posts.** A category page
with one post is a duplicate of that post, and an empty taxonomy is exactly the
thin-content pattern to avoid. Start with all five as tags in the frontmatter
and publish the category pages as they earn their third post.

**Training together is the category to over-invest in.** It is the wedge from
the roadmap, nobody else owns it, and it is the only category where we are the
obvious answer rather than one of fifty.

---

## Post archetypes

Five shapes, each doing a job the evergreen pages cannot. Roughly the mix to aim
for across a quarter.

| Archetype             | Share  | What it is                                                                      | Why it works                                                                   |
| --------------------- | ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Data story**        | 1 in 6 | We counted something and published it                                           | The strongest citation and link magnet we have. `/stats` is the template       |
| **Specific scenario** | 2 in 6 | "AMRAP workouts for a hotel room", "for two people", "when you have 12 minutes" | Long-tail intent too narrow for a library page, and closest to purchase intent |
| **Seasonal / timely** | 1 in 6 | The Open, January, holiday training                                             | Cannot be served by an evergreen page at all — this is the pure freshness play |
| **Opinion / POV**     | 1 in 6 | "Why we do not publish a good AMRAP score", "the case against the leaderboard"  | Earns links and shares; carries the brand voice the reference pages cannot     |
| **Teardown**          | 1 in 6 | Analysing a named workout or a training block in depth                          | Deep, specific, and links naturally to twenty library pages                    |

Every post is written answer-first, the same discipline as `GuideLayout`: the
direct answer in 40–60 words above any preamble, because that is the chunk an
assistant lifts.

---

## How the blog actually improves SEO coverage

Four mechanisms, in descending order of value. Only the first two are about the
posts themselves.

### 1. Freshness for AI search

Covered above. This is the primary case and it applies to the domain, not just
the post.

### 2. Internal link distribution

The blog is a link engine pointed at the pages that convert. Every post must:

- link **up** to the pillar it belongs to (`/amrap-workouts`, `/guides/...`),
  passing authority to the pages we actually want ranking;
- link **down** to at least two specific library pages (a workout, a movement);
- link **across** to one or two related posts.

This is the compounding part. A hundred posts each linking up to
`/amrap-workouts` does more for that page than any single post does for itself.

### 3. Long-tail capture without damaging the pillars

`/amrap-workouts/20-minute` should not try to also answer "20-minute AMRAP for a
hotel room with no floor space". Cramming that in makes the collection page
worse for its own query. A post takes it, and links back.

### 4. Entity and authorship signals

Fitness sits close enough to health that expertise signals carry more weight
here than in most niches. Posts should be **bylined by a real person with a real
bio and stable author page**, and that person should be the same entity across
the site and off it. This is also the honest answer to the concern raised when
drafting the movement content: guidance published under a name needs a name
behind it.

---

## Technical architecture

Fits the existing Astro layer with no new infrastructure:

- **Astro content collections** for posts (`site/content/blog/*.md`), so the
  frontmatter is schema-validated at build time and a malformed post fails the
  build rather than shipping.
- **`/blog/[slug]`** — flat, no dates in the URL. A date in the path makes a
  refreshed post look stale and makes the canonical awkward when it changes.
- **Route table:** `/blog` as a `CONTENT_ROUTES` row, `/blog/:slug` in
  `DYNAMIC_CONTENT_ROUTES`. The sitemap and the middleware then handle posts
  with no further work, and `merge-build.ts` already fails the build if the
  sitemap lists a page that was not built.
- **`BlogPosting` schema** with `datePublished`, `dateModified` and a real
  `author` node. `dateModified` is what a freshness filter reads, so it must be
  accurate — set it from the file, never from the build clock, or every page
  claims to have changed on every deploy.
- **RSS feed** at `/blog/rss.xml`. Cheap, and it is how aggregators and several
  crawlers discover new posts fastest.
- **Per-post OG images.** `scripts/generate-og-images.ts` already composes them
  from the brand marks; extend it to take a title. Share CTR is most of what a
  social post's performance is, and a generic card costs it.
- **`/blog` in the nav**, and the category pages linked from it, so nothing is
  orphaned — `merge-build.ts` and the orphan check keep that honest.

---

## Social

Two things to be clear about before the tactics.

**Social links are `nofollow` and pass no authority directly.** Anyone telling
you posting to X moves rankings is selling something. The value is real but
indirect: distribution to people who might link, and the fact that several
platforms are themselves search surfaces.

**The platforms are the point, not the links.** Reddit and YouTube are search
engines. X is what Grok grounds in. That makes presence on them an AI-search
play, which is the same play as the blog itself.

| Platform               | What goes there                                                                                                                  | Honest expectation                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Reddit**             | Participate in r/crossfit, r/homegym, r/bodyweightfitness as a person. Answer questions. Link only when it genuinely answers one | Highest leverage and highest risk. Heavily weighted in AI answers. Astroturfing is both wrong and detectable — do not |
| **YouTube**            | A workout running on the synced timer, movement demos                                                                            | Its own search engine, and the only format that shows the product working                                             |
| **X**                  | Post excerpts and data cards natively                                                                                            | The only real lever on Grok                                                                                           |
| **Instagram / TikTok** | Movement demos from the exercise media                                                                                           | Reach, not SEO. Now viable since the images resolve                                                                   |
| **Email**              | A monthly digest of new posts                                                                                                    | The one channel no algorithm sits between us and the reader                                                           |

**Repurpose natively, do not link-drop.** A post becomes a carousel, a thread, a
short — each readable without leaving the platform. A bare link posted to five
platforms performs on none of them.

**The one social tactic that actually moves SEO** is not posting at all: it is
getting into the "best AMRAP timer apps" roundups that assistants synthesise
their answers from. That is outreach, and it belongs to Part 6 of the roadmap.

---

## Measurement

Ties into what the roadmap already set up.

| Metric                                        | Why                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Missions created from a post**              | The only conversion that matters. Traffic that never starts a workout is vanity                   |
| **Posts cited in the monthly LLM audit**      | Whether the freshness play is working. This is the primary blog KPI                               |
| **Assisted conversions**                      | Posts rarely convert on the first visit; measuring last-click will make good posts look worthless |
| **Page-2 posts**                              | The refresh queue, generated automatically from GSC                                               |
| **Posts with zero impressions after 90 days** | The prune list                                                                                    |

**Pruning is part of the strategy, not a failure of it.** A post with no
impressions after 90 days should be improved, merged into a stronger page, or
removed. Dead posts dilute the site's overall quality signal, which the Helpful
Content system assesses sitewide rather than per page.

---

## Authoring

The voice specification, the twenty-four article briefs and the twelve-month
calendar live in [blog authoring](blog-authoring.md). It also covers the byline
question raised below — the short version being that the persona is a voice, not
a fictional person, and articles get a real name or the team's name on them.

## First twelve posts

Ordered to front-load the categories that have the least competition and the
clearest link back to the product.

| #   | Post                                                                          | Category          | Archetype  |
| --- | ----------------------------------------------------------------------------- | ----------------- | ---------- |
| 1   | What 150 AMRAP workouts taught us about programming for a time cap            | The data          | Data story |
| 2   | The 12-minute AMRAP: what to do when you only have a lunch break              | Programming       | Scenario   |
| 3   | How to run an AMRAP with a friend in another time zone                        | Training together | Scenario   |
| 4   | Why we refuse to tell you what a good AMRAP score is                          | Pacing & scoring  | Opinion    |
| 5   | Hotel-room AMRAPs: five workouts for two square metres                        | Programming       | Scenario   |
| 6   | Air squats are in one in six AMRAP workouts. Here is how to stop wasting them | Movement          | Teardown   |
| 7   | Building an eight-week campaign around one benchmark                          | Training together | Teardown   |
| 8   | The first ninety seconds: reading your own pace variance                      | Pacing & scoring  | Teardown   |
| 9   | AMRAP workouts for two people with one set of equipment                       | Training together | Scenario   |
| 10  | January: how to restart training without wrecking week one                    | Programming       | Seasonal   |
| 11  | The case against the live leaderboard                                         | Training together | Opinion    |
| 12  | Push-up variations ranked by how they fail under fatigue                      | Movement          | Teardown   |

At two a month that is six months of publishing, by which point there will be
real GSC data to plan the next twelve from rather than guesses.

---

## Open questions

1. **Who writes and who bylines?** The authorship point above is not decoration
   — it is the difference between a fitness blog that ranks and one that does
   not. Same question as the movement content, and it needs the same answer.
2. **Does the data story wait for athlete data?** Post 1 works today from the
   library. The much stronger version needs recorded missions, and publishing
   the weak version first spends the idea.
3. **Two a month, or one?** Two is the recommendation. One a month plus two
   refreshes is a defensible smaller commitment that still keeps something under
   30 days old.
4. **Is the blog worth it before the current 117 pages have been given time?**
   Genuinely arguable. They have had days, not months. A reasonable alternative
   is to wait 8–12 weeks, read the GSC data, and let it tell us which posts to
   write — at the cost of no freshness signal during that window.
