# Plan: the AMRAP science hub

**Branch:** `claude/amrap-science-hub`
**Status:** Draft for approval — **the source artifact is not publishable as-is**
**Last updated:** 2026-09-05
**Source:** `amrap_hift_science_explorer.html`, generated with Gemini

---

## Verdict in one paragraph

The **topic** is the most valuable content asset available to this site. Nobody
in the AMRAP timer space has a properly sourced physiology reference, the author
has the credentials to publish one, and it is exactly the shape of content that
earns citations and links rather than rankings alone. The **artifact**, however,
carries no citations at all while calling itself a "Peer-Reviewed Exercise
Physiology Synthesis" and displaying a "Peer Review Verified" badge, and several
of its most quotable numbers do not survive checking. Publishing it in its
current form under a real Master Fitness Trainer's byline would be the most
damaging thing this project has done. It should be treated as a **research
brief**, not a deliverable.

---

## The audit

### What is real and worth keeping

| Claim                                                                                   | Status                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~75-second aerobic/anaerobic crossover in maximal effort                                | **Confirmed.** Gastin, _Sports Medicine_ 31(10):725–741, 2001 (doi:10.2165/00007256-200131100-00003, PMID 11547894). A 2026 systematic review puts it at ~75–80 s |
| All energy pathways engage from exercise onset; the "sequential buckets" model is wrong | **Confirmed**, and it is the correct correction to make                                                                                                           |
| Lactate shuttle; lactate as fuel, not waste; MCT1/MCT4 transporters                     | **Real** — Brooks' hypothesis, well established                                                                                                                   |
| Teleoanticipation and pacing as centrally regulated                                     | **Real framework**, but see the caveat below                                                                                                                      |
| HIMA vs PIMA — holding versus pushing isometrics fatigue differently                    | **Real** and genuinely current research                                                                                                                           |
| Clock deception influences pacing at 10%, not at ≤5%                                    | **Real**, though not with the effect size claimed                                                                                                                 |
| "Cindy" and "Fight Gone Bad" have published physiological data                          | **Real** — CrossFit benchmark telemetry has been studied                                                                                                          |

### What does not survive checking

Every one of these is stated to a decimal place with no source. Specific,
unsourced precision is the signature of a generated number.

| Claim in the artifact                                                                  | Problem                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Slowing the visible clock by 10% increases endurance time by an average of **18.3%**" | **Not supported.** The literature shows ≤5% deception has no effect, 10% can shift pacing, and one time-trial study found an improvement of ~5.8 _seconds_. Nothing supports 18.3% |
| HIMA 55% vs PIMA 82% force retention                                                   | Unsourced                                                                                                                                                                          |
| Post-workout velocity drop 13.8%; countermovement jump loss 7.3%                       | Unsourced                                                                                                                                                                          |
| Cindy VO₂ 33.3 ml/kg/min, "63.8% of VO₂max"                                            | Unsourced                                                                                                                                                                          |
| Female countermovement jump loss −3.2%                                                 | Unsourced **and** the highest-risk claim on the page                                                                                                                               |
| "+18% average work velocity" for segmented vs continuous                               | Unsourced                                                                                                                                                                          |
| "Aerobic Energy Yield: 78%" at an 8-minute cap                                         | Unsourced; the underlying model does not extend that cleanly                                                                                                                       |

### Framing problems, independent of the numbers

- **"Peer Review Verified" badge and "Peer-Reviewed Synthesis" heading.** The
  document has not been peer reviewed. Displaying that badge is a false claim
  about provenance, and it is the first thing a sceptical reader would check.
- **"Modern research proves…"** Research supports; it rarely proves.
- **The central governor model is contested**, not settled. Presenting it as
  established fact is a credibility risk with exactly the informed readers this
  page is meant to impress. Saying "an influential and still-debated model" is
  both more accurate and a stronger expertise signal.
- **The sex-differences module is YMYL-adjacent** — biological claims, specific
  percentages, no sources, on a fitness site under a named practitioner. It
  carries the most risk and the least citation support. It ships last or not at
  all.
- A typo, "Sclares glycogen store utilization", indicates the artifact has not
  had a careful read.

**A correction to the first draft of this audit.** It grouped the Cindy
telemetry with the invented numbers because it was unsourced. Checking them
against the literature while writing `/science/energy-systems` showed they are
real and traceable to a published pilot study. Unsourced is not the same as
fabricated — the artifact mixed both, which is exactly why every number had to
be checked individually rather than judged as a batch.

**This is not a criticism of using an LLM for research.** It is a criticism of
shipping the first pass. The concepts it surfaced are correct and genuinely
useful; the job left undone is finding the papers and dropping everything that
has none.

---

## What it should become

A fifth content pillar: **`/science/`**, a hub plus one page per module. Each
module is a distinct query cluster, so this is roughly six pages of the most
link-worthy content on the site.

```
/science/                              hub — what the research says about AMRAP
/science/energy-systems                the 75-second crossover, time domains
/science/lactate                       the shuttle, why "lactic acid burn" is wrong
/science/pacing                        teleoanticipation, central governor, our PVI
/science/fatigue                       velocity loss, HIMA vs PIMA, movement choice
/science/benchmark-telemetry           what has actually been measured on Cindy et al.
```

### The rule that governs every page

> **A claim ships with a citation, or it does not ship.**

Inline, linked to a DOI or PubMed entry. No "studies show". No number without a
source. Where the honest answer is that the research is thin or contested, say
so — that is a stronger expertise signal than false confidence, and it is the
thing generated content never does.

### Sequencing

1. **`/science/energy-systems` first.** It is the best-sourced module (Gastin is
   solid, the crossover is confirmed by a recent systematic review) and it feeds
   the highest-volume query the site has: _how long should an AMRAP be_.
2. **`/science/pacing` second.** It gives our own Pace Variance Index a
   published-research backbone, which turns an in-house metric into a defensible
   one. Cite the deception literature accurately — the real finding (10% shifts
   pacing, ≤5% does not) is more interesting than the invented one.
3. **`/science/lactate` third.** Well-established, easy to source, and corrects
   a misconception readers actively search for.
4. **`/science/fatigue`** once HIMA/PIMA sources are pulled.
5. **`/science/benchmark-telemetry`** and the sex-differences material **last**,
   and only with citations in hand.

### Trust furniture every page carries

- **A sourcing note:** who wrote it, that it is a practitioner's synthesis of
  published research rather than original research, and the date it was last
  checked against the literature.
- **Author attribution** to the existing `Person` entity — a Master Fitness
  Trainer synthesising exercise physiology is the credential doing real work
  here, and it is already wired up.
- **A reference list** per page, with DOIs.
- **A "not medical advice" line**, consistent with `/terms`.

### Schema

`Article` with `citation` entries for each referenced paper, `author` pointing at
`AUTHOR_ID`, and `about`/`mentions` for the concepts. **Not `ScholarlyArticle`**
— that would overclaim in exactly the way the source artifact does.

### The interactive pieces

The charts and calculators are the linkable asset — "AMRAP energy system
calculator" is the kind of page people link to without being asked, which is the
link-earning play this site does not otherwise have.

Two constraints. They are Chart.js, so they become Astro islands hydrated with
`client:visible`, and the page's substance must be in static HTML regardless —
a crawler that runs no JavaScript should still get the whole argument. And the
numbers driving them must be sourced, or the chart is a picture of a
fabrication.

Ship each page static first, add the island once the data behind it is cited.

### How it feeds the rest of the plan

- Blog article 16, _How Long Should an AMRAP Be?_, gains a research backbone and
  links up to `/science/energy-systems`.
- Blog article 11, _The First 90 Seconds_, links to `/science/pacing`.
- `/guides/amrap-pacing` gets a citation for the pacing model behind PVI.
- `/stats` and `/science/` are the two pages most likely to be cited by an
  assistant. They should link to each other.

---

## What is needed before any of this ships

1. **The papers.** Everything above depends on pulling the actual sources. The
   Gastin citation is in hand; the rest are not.
2. **A decision on the sex-differences module** — source it properly or drop it.
   Given the risk profile, dropping it costs little.
3. **Nothing from the artifact is copied verbatim.** It is a map of what to
   research, not a draft.
