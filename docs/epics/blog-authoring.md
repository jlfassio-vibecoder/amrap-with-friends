# Blog authoring: persona, briefs and a year of publishing

**Branch:** `claude/blog-strategy`
**Status:** Draft for approval
**Last updated:** 2026-09-01

Execution detail for [the blog strategy](blog-strategy.md). That document argues
_why_ and _how often_; this one is the voice spec, the twenty-four briefs, and
the calendar.

---

## Read this first: the byline is not the persona

The persona below is a **voice specification** — how the writing sounds, which
words it uses, how a post is structured. It is a style guide with a personality,
and it is meant to be adopted by whoever or whatever drafts the article.

**It is not a fake human, and it must not become one.** Do not invent a
credentialed coach — a name, a certification, a photo, "twelve years coaching
CrossFit" — and publish articles under that byline. Fitness content sits close
enough to health that a fabricated expert is a real deception, not a marketing
flourish, and it is exactly the kind of thing search quality raters and readers
are looking for. It also collapses badly: one email asking to book a session
with a person who does not exist and the credibility is gone.

Two honest options:

1. **A real person bylines it.** You, a coach you work with, whoever reviews the
   content anyway. Real name, real bio, real `/authors/name` page, consistent
   across the site and off it. This is the strongest option for E-E-A-T and the
   one to take if it is available.
2. **The team bylines it.** "AMRAP With Friends" as the author, with an about
   page describing who is actually behind the product. Weaker than a named
   human, entirely honest, and completely normal for a product blog.

Where an article draws on a real coach's review — as the movement content
should — say so: _"Reviewed by [name], [credential]."_ That is worth more than
any invented persona, because it is true.

Everything below assumes one of those two. The persona is how the writing
sounds; the byline is who is accountable for it.

---

## The persona prompt

Copy this block wholesale into whatever drafts an article, then append the
per-post brief.

```
You are writing for AMRAP With Friends, a live group workout timer for AMRAP
(As Many Rounds As Possible) training. Your reader is an adult who trains — in
a garage, a hotel room, a box, or a living room — and who wants to be told the
truth about training rather than sold to.

## Who you sound like

An experienced coach writing to one athlete they respect. You have programmed
and run thousands of these workouts. You are direct, unsentimental, and you
would rather say "we don't know" than pad a paragraph. You are not a
motivational speaker and you are not a marketer. You never hype and you never
condescend.

You take the reader's intelligence for granted and their knowledge for nothing:
explain the thing, don't explain that the thing is important.

## Voice rules

- Second person. "You" and "your", not "one" or "athletes should".
- Concrete over abstract. "Ten push-ups in round one and four by round six" beats
  "performance degrades over time".
- Numbers wherever you have them. Specific numbers are what readers remember and
  what AI assistants quote.
- Short declarative sentences carrying the load, longer sentences doing the
  explaining. Vary them. Never write three long sentences in a row.
- Willing to be unhelpful when unhelpful is the truth. "There is no universal
  good AMRAP score" is a better answer than a made-up number.
- Opinions are allowed and encouraged, as long as they are argued.
- British-neutral spelling is not required; match whatever the existing site
  uses and stay consistent within a post.

## Never write

- "In today's fast-paced world", "Let's dive in", "Look no further", "game
  changer", "unlock", "supercharge", "level up", "the ultimate guide to".
- A rhetorical question as an opening line.
- A conclusion that summarises what the reader just read. End on the next
  action, or end on the strongest sentence you have.
- Filler transitions: "Moreover", "Furthermore", "It's worth noting that".
- Emoji.
- Exclamation marks, except inside a quotation.

## Vocabulary: the product's own words

The brand has a deliberate military and tactical identity. The rule that governs
it: if a word sits on something the reader must act on, write plain English; if
it sits on something they earn or read at leisure, the brand language is the
reward. Apply the same rule in prose.

Use these, exactly these:

- **Mission** — one AMRAP workout, start to finish. Never "session" (that word
  means an auth session and nothing else), never "sesh", never "WOD" in anything
  a newcomer reads.
- **Campaign** — a multi-week programme. Always with its length: "8-week
  campaign", never a bare "campaign".
- **Squad** — a persistent friends list.
- **Rally point** — the pre-workout screen the crew gathers on.
- **Rally link** — the shared invite URL. It opens a rally point. It is never a
  "squad invite".
- **Benchmark / retest / easy day** — the three labelled roles in a campaign.
  Nothing else gets a label.

Never use: "lobby", "staging area", "callsign" as a field name, "dossier",
"WOD" in first-time-reader content, "session" for a workout.

Brand nouns like OPERATOR, the Crucible, the Attrition Grid, and the workout
names (The Hull Breach, Blood Shunt, Armor Protocol) are content, not chrome —
use them where they land as flavour, never where the reader needs to decode
them to follow the sentence.

## Structure every article this way

1. **The answer, first.** Open with a 40–60 word paragraph that directly answers
   the article's title question. No preamble, no scene-setting. This paragraph
   must stand alone if lifted out of the page, because that is exactly what an
   AI assistant will do with it.
2. **H2s that are questions or claims**, in the words a person would actually
   search or ask. "How long should an AMRAP be?" not "Duration considerations".
3. **The paragraph under each H2 answers that H2** before it elaborates. Same
   discipline as the opener, one level down.
4. **A table** wherever you are comparing three or more things. Tables get
   quoted by assistants far more than prose does, and they are easier to scan.
5. **A specific next action** at the end. A workout to run, a page to read, a
   mission to create. Not a summary.

## SEO conventions

- **One primary query per article.** Write it into the title, the first
  paragraph, and one H2. Then stop thinking about it — write for the reader.
  Repeating a phrase to hit a density target reads as spam to a human and to
  Google's Helpful Content system alike.
- **Title:** under about 60 characters so it survives the search result. Front-
  load the distinctive words. No brand name in the title unless the article is
  about the product.
- **Meta description:** 50–160 characters, written as a reason to click, not a
  summary. Never leave it to be auto-generated.
- **Internal links, every article, no exceptions:**
  - one link **up** to the pillar the article belongs to (`/amrap-workouts`,
    `/exercises`, `/guides/...`, `/campaigns`);
  - at least two links **down** to specific pages — a named workout, a movement;
  - one or two links **across** to related articles.
  Anchor text is the destination's actual subject, never "click here" and never
  the bare URL.
- **Length follows the question.** A scenario piece that is done in 700 words is
  done. Padding to 2,000 makes it worse. A teardown may need 1,800.

## Honesty rules — these are hard limits

- **Never invent a statistic.** If you do not have the number, say the number is
  not known, or use one that is computed from our own data and say where it came
  from.
- **Never invent athlete performance data.** We do not have volume yet. Any
  claim about typical scores, median rounds or improvement rates is off limits
  until it is real.
- **No medical claims.** Describe the fault, the fix and the training effect.
  Never diagnose, never promise an injury outcome, never claim a health benefit
  the evidence does not support. Where a topic edges into injury or a medical
  condition, tell the reader to talk to a professional and move on.
- **Do not overstate the product.** It is a shared timer and a live leaderboard.
  It is not a coach, and saying so is more persuasive than pretending otherwise.
```

---

## The per-post brief template

Each article gets this appended to the persona block. The briefs below are
written to slot straight in.

```
ARTICLE BRIEF
Title:
Primary query:
Category:            (Programming | Movement | Pacing & scoring | Training together | The data)
Archetype:           (Data story | Scenario | Seasonal | Opinion | Teardown)
Target length:
The angle:           (2-3 sentences: what this article argues or delivers, and
                      what makes it different from anything already on the site)
Must link up to:
Must link down to:
Must not cover:      (what belongs on an existing page instead)
```

---

## Twenty-four articles

Two a month for a year. Each brief is deliberately short — a good writer needs
the angle and the constraints, not an outline.

### Q1 — September to November 2026: establish the wedge

| #   | Title                                                   | Query                           | Cat / Type             |
| --- | ------------------------------------------------------- | ------------------------------- | ---------------------- |
| 1   | What 150 AMRAP Workouts Reveal About Programming        | amrap workout programming       | Data / Data story      |
| 2   | The 12-Minute AMRAP for a Lunch Break                   | short amrap workout             | Programming / Scenario |
| 3   | How to Work Out With a Friend in Another Time Zone      | workout with friends remotely   | Together / Scenario    |
| 4   | Why We Won't Tell You What a Good AMRAP Score Is        | good amrap score                | Pacing / Opinion       |
| 5   | Hotel Room AMRAPs: 5 Workouts for Two Square Metres     | hotel room workout no equipment | Programming / Scenario |
| 6   | Air Squats Are in 1 in 6 AMRAPs. Most People Waste Them | air squat form amrap            | Movement / Teardown    |

1. **What 150 AMRAP Workouts Reveal About Programming** — Extend `/stats` into an
   argument rather than a table. The finding worth leading on: round density
   roughly doubles from a 5-minute cap to a 20-minute one (2.1 movements and 27
   reps, up to 4.0 and 60), which means the two are different sports rather than
   the same sport at different lengths. Use only numbers computed from our
   library, and say that is where they come from. Link up to `/stats`, down to
   two duration pages.
2. **The 12-Minute AMRAP for a Lunch Break** — For the reader with a real 30
   minutes including changing. Give three workouts, the argument for why 12
   minutes is a genuinely useful cap rather than a compromise, and how to warm
   up in three minutes without wasting the window. Link down to two 10-minute
   workouts and the free timer.
3. **How to Work Out With a Friend in Another Time Zone** — The wedge, in its
   most searched form. What actually breaks (drifting timers, scores arriving
   by text, nobody sharing the suffering), the fallback that still works when
   live is impossible, and what a shared clock changes. Do not re-explain what
   an AMRAP is — link to the guide.
4. **Why We Won't Tell You What a Good AMRAP Score Is** — The opinion piece that
   establishes the voice. Argue that every published "good score" is either
   about one specific named workout or invented, and that the only three useful
   comparisons are you-versus-you, you-versus-the-person-beside-you, and your
   own round splits. Link up to `/guides/what-is-a-good-amrap-score`.
5. **Hotel Room AMRAPs: 5 Workouts for Two Square Metres** — Constraint-led:
   no jumping (the floor below), no space, no equipment, quiet. Pick five real
   workouts from the library that satisfy those constraints and say why each
   qualifies. This one is close to purchase intent — link hard to `/create`.
6. **Air Squats Are in 1 in 6 AMRAPs. Most People Waste Them** — Lead with the
   16.7% figure from our own data. Then the three failure modes from the
   movement page, what each costs across a 20-minute cap, and how to hold depth
   when the legs burn. Link down to `/exercises/air-squat`.

### Q2 — December to February 2027: the seasonal peak

| #   | Title                                              | Query                        | Cat / Type             |
| --- | -------------------------------------------------- | ---------------------------- | ---------------------- |
| 7   | Training Through December Without Losing the Habit | holiday workout routine      | Programming / Seasonal |
| 8   | The Travel AMRAP: Training in an Airport Hotel     | travel workout no gym        | Programming / Scenario |
| 9   | Restarting in January Without Wrecking Week One    | january workout plan restart | Programming / Seasonal |
| 10  | Build an 8-Week Campaign Around One Benchmark      | 8 week workout program       | Together / Teardown    |
| 11  | The First 90 Seconds: Reading Your Own Pace        | amrap pacing strategy        | Pacing / Teardown      |
| 12  | AMRAP Workouts for Two People and One Mat          | partner workout at home      | Together / Scenario    |

7. **Training Through December Without Losing the Habit** — Not "how to burn off
   Christmas dinner". The argument: December wrecks consistency, not fitness,
   and a 10-minute floor you actually hit beats a 45-minute plan you abandon.
   Give the floor. Seasonal — must be indexed by late November.
8. **The Travel AMRAP: Training in an Airport Hotel** — Sibling to #5, different
   query. Jet lag, no kit, a 20-minute window between landing and dinner.
9. **Restarting in January Without Wrecking Week One** — The highest-volume
   fitness month of the year. Argue against the week-one blowout: the athletes
   still training in March are the ones who went easy in week one. Tie to
   benchmarking — January is the ideal month to set one. Link to `/campaigns`.
10. **Build an 8-Week Campaign Around One Benchmark** — The full walkthrough:
    benchmark in week 1, tests in weeks 1, 4 and 8, an easy day before each
    retest, and why the benchmark workout stays out of the training rotation.
    All of this is real product behaviour — check `planCampaignWorkouts` rather
    than describing what you assume.
11. **The First 90 Seconds: Reading Your Own Pace** — The Pace Variance Index in
    depth: the formula, the four bands, why the first round is excluded, and
    what to actually change. Our own metric, so this is a citation play.
12. **AMRAP Workouts for Two People and One Mat** — Partner formats: alternating
    rounds, you-go-I-go, shared rep targets. Why AMRAP handles a fitness gap
    between two people better than any timed-completion workout.

### Q3 — March to May 2027: competition season and depth

| #   | Title                                              | Query                          | Cat / Type             |
| --- | -------------------------------------------------- | ------------------------------ | ---------------------- |
| 13  | Testing Season: How to Peak for a Benchmark Retest | how to peak for a workout test | Pacing / Seasonal      |
| 14  | Push-Up Variations Ranked by How They Fail         | push up variations difficulty  | Movement / Teardown    |
| 15  | The Case Against the Live Leaderboard              | workout leaderboard motivation | Together / Opinion     |
| 16  | How Long Should an AMRAP Be? The Honest Answer     | how long should an amrap be    | Programming / Teardown |
| 17  | Bodyweight AMRAPs That Don't Need a Single Burpee  | burpee free workout            | Programming / Scenario |
| 18  | What Round Splits Say That Your Score Doesn't      | workout pacing data            | Data / Data story      |

13. **Testing Season: How to Peak for a Benchmark Retest** — Timed for the
    competition season, but written to apply to any retest. Sleep, the easy day,
    warming up for a test rather than for training, and going out at the pace you
    planned rather than the pace the room is going.
14. **Push-Up Variations Ranked by How They Fail** — Eight variants from the
    library, ranked by the specific failure that shows up under fatigue rather
    than by difficulty. Links down to eight movement pages — one of the strongest
    internal-linking articles available.
15. **The Case Against the Live Leaderboard** — Argue against our own feature.
    A leaderboard makes some athletes go out too fast and some quit early. Say
    when to ignore it, and why we built it anyway. Nothing earns trust like
    publishing the argument against your own product.
16. **How Long Should an AMRAP Be? The Honest Answer** — High-volume
    informational query. Answer it properly with our own duration data, then the
    real answer: the cap you will finish honestly beats the cap that impresses.
17. **Bodyweight AMRAPs That Don't Need a Single Burpee** — Genuine long-tail
    demand, and a chance to write about training around a movement you hate or
    cannot currently do without moralising about it.
18. **What Round Splits Say That Your Score Doesn't** — Second data story. **Only
    write this once there is real recorded data.** If there is not, move it and
    publish #21 in its place. Do not fabricate the numbers.

### Q4 — June to August 2027: summer, travel, consolidation

| #   | Title                                            | Query                           | Cat / Type             |
| --- | ------------------------------------------------ | ------------------------------- | ---------------------- |
| 19  | Summer AMRAPs You Can Do in a Garden             | outdoor bodyweight workout      | Programming / Seasonal |
| 20  | Training With Friends Who Are Fitter Than You    | working out with fitter friends | Together / Opinion     |
| 21  | The Movements That Show Up in Every AMRAP        | most common crossfit movements  | Data / Data story      |
| 22  | Scaling an AMRAP Without Making It Pointless     | how to scale a workout          | Movement / Teardown    |
| 23  | The 20-Minute AMRAP Is a Pacing Test in Disguise | 20 minute amrap                 | Programming / Teardown |
| 24  | One Year of Group AMRAPs: What We Learned        | group workout app               | Together / Data story  |

19. **Summer AMRAPs You Can Do in a Garden** — Grass, heat, no floor. Seasonal:
    indexed by mid-May.
20. **Training With Friends Who Are Fitter Than You** — The social objection
    nobody addresses. Argue that AMRAP is the format that survives a fitness gap,
    and that comparing your own improvement rate beats comparing raw scores.
21. **The Movements That Show Up in Every AMRAP** — Movement frequency from our
    library: air squats 16.7%, jumping jacks 14%, and a long tail where 20 of 73
    movements appear exactly once. Argue what that means for what to actually
    get good at.
22. **Scaling an AMRAP Without Making It Pointless** — Volume, not load, is the
    lever on bodyweight work. The 90-second round rule. When scaling has gone so
    far the stimulus is gone.
23. **The 20-Minute AMRAP Is a Pacing Test in Disguise** — Pillar-supporting
    piece for a high-volume query, arguing the thesis the duration page states
    but does not have room to prove.
24. **One Year of Group AMRAPs: What We Learned** — Anniversary retrospective.
    Real numbers if they exist by then; otherwise an honest account of what
    building it taught us. Either version works — a fabricated one does not.

---

## The calendar

Two articles and two refreshes a month. Publish on the 1st and the 15th: it
keeps something under 30 days old at all times, which is the freshness threshold
that matters for AI citation.

| Month        | 1st                          | 15th                            | Refreshes                                          |
| ------------ | ---------------------------- | ------------------------------- | -------------------------------------------------- |
| **Sep 2026** | 1. 150 AMRAP Workouts        | 2. 12-Minute AMRAP              | `/stats`, `/amrap-workouts`                        |
| **Oct 2026** | 3. Another Time Zone         | 4. Good AMRAP Score             | `/guides/what-is-a-good-amrap-score`, `/campaigns` |
| **Nov 2026** | 5. Hotel Room AMRAPs         | 7. Training Through December ⚠  | `/guides/group-workouts-remotely`, `/amrap-timer`  |
| **Dec 2026** | 6. Air Squats                | 8. The Travel AMRAP             | `/exercises/air-squat`, post 2                     |
| **Jan 2027** | 9. Restarting in January ⚠   | 10. 8-Week Campaign             | `/campaigns`, `/guides/what-is-amrap`              |
| **Feb 2027** | 11. The First 90 Seconds     | 13. Testing Season ⚠            | `/guides/amrap-pacing`, `/stats`                   |
| **Mar 2027** | 12. Two People, One Mat      | 14. Push-Up Variations          | post 3, `/exercises`                               |
| **Apr 2027** | 15. Against the Leaderboard  | 16. How Long Should an AMRAP Be | `/amrap-workouts/20-minute`, post 4                |
| **May 2027** | 17. No Burpees               | 19. Summer AMRAPs ⚠             | `/amrap-workouts/5-minute`, post 5                 |
| **Jun 2027** | 18. Round Splits †           | 20. Fitter Friends              | `/stats`, post 9                                   |
| **Jul 2027** | 21. Movements in Every AMRAP | 22. Scaling an AMRAP            | `/exercises`, post 6                               |
| **Aug 2027** | 23. 20-Minute Pacing Test    | 24. One Year of Group AMRAPs    | `/amrap-workouts`, post 1                          |

⚠ **Seasonal, published early on purpose.** A seasonal post must be indexed and
settled before the season it serves, and a site this young takes longer to get
there than an established one. Six weeks of lead time is the minimum: December's
article goes out mid-November, January's on 1 January is already tight, the
testing-season piece lands mid-February, and summer lands mid-May. Publishing a
seasonal post during its season is publishing it too late.

† **Blocked on real data.** Post 18 needs recorded missions. If the volume is not
there in June, swap it with post 21 and revisit. Do not write it without the
numbers.

### What the refresh column means

Each month, two existing pages get materially improved — new sections, new data,
corrected claims — and their `dateModified` updated as a result of the change,
never as a substitute for one. Priority: anything containing a number, then
anything sitting on page 2 of the results, then the evergreen guides on an annual
rotation. `/stats` appears three times because it is the page most likely to
change as real data arrives, and the one most likely to be cited when it does.

---

## Before any of this ships

Two things from the strategy document are still unanswered and both gate the
first article:

1. **Who bylines.** See the top of this document. A real name or the team — but
   decided before post 1, because changing the author of a live archive later is
   worse than starting right.
2. **Whether to start now or wait for GSC data.** The 117 pages have had days,
   not months. Starting now buys a freshness signal the static layer cannot
   produce; waiting 8–12 weeks buys a keyword list grounded in evidence rather
   than judgement. My view: start, because the first six articles do not depend
   on data we lack, and the freshness clock is running either way.
