# My missions readmes

Operator and engineer notes for the **shipped** `/my-missions` surface.

These describe what the page does, how data reaches it, and how to reason about
changes. Planning stays in [`docs/epics/`](../../epics/) and
[`docs/plans/`](../../plans/). Deeper investigations can also live in
[`docs/audits/`](../../audits/).

## Naming

| Pattern                | Use                                      |
| ---------------------- | ---------------------------------------- |
| `README.md`            | This index only                          |
| `{topic}.md`           | One capability or assessment (kebab-case)|
| `{yyyy-mm}-{topic}.md` | Optional when two writeups share a topic |

Prefer the topic as the filename so new notes can sit beside each other without
colliding.

## Contents

| Doc                                                                        | What it covers                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [architecture-assessment.md](./architecture-assessment.md)                 | Architectural map, gap analysis, prioritized risks (2026-09)                   |

## What the page is

`/my-missions` is the signed-in athlete’s **account history hub**: missions they
saved or hosted, plus nested panels for squad-assigned workouts, campaigns, and
progression derived from that history.

It is **not** the waiting room (`/mission/:id`), the Next Mission hub
(`/rally-point/:id`), or the HUD (`/hud`). Those surfaces own live clocking,
daisy-chain command, and long-term score trends respectively.

## Quick map

| Concern        | Where it lives                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| Route          | `src/App.tsx` — lazy `MyMissionsPage`, no `RequireIntake`                      |
| Page           | `src/pages/MyMissionsPage.tsx`                                                 |
| History RPC    | `my_missions()` (slim) + `my_mission_detail` → `src/lib/api/myMissions.ts` |
| Chain grouping | `src/lib/mission/groupMyMissionsByRallyPoint.ts` + embedded `chains` from list RPC |
| Campaigns      | `MyCampaignsPanel` → `my_campaigns`                                            |
| Assigned       | `AssignedWorkoutsPanel` → assigned-workout RPCs                                |
| SEO            | `src/lib/seo/routes.ts` — `index: false`                                       |

## Vocabulary

On this page, use **mission** for every workout row. Campaigns keep their length
(“8-week campaign”). Do not put WOD, staging, lobby, or session-as-workout on
click paths or state labels athletes must understand to proceed.
