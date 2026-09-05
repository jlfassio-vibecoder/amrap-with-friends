# Coach analytics readmes

Operator and engineer notes for **shipped** Coach analytics behaviour.

These are not epics or audits. They describe what landed, how to use it, and how to deploy it. Planning stays in [`docs/epics/`](../../epics/); investigations stay in [`docs/audits/`](../../audits/).

## Naming

| Pattern                | Use                                      |
| ---------------------- | ---------------------------------------- |
| `README.md`            | This index only                          |
| `{topic}.md`           | One shipped capability (kebab-case)      |
| `{yyyy-mm}-{topic}.md` | Optional when two writeups share a topic |

Do not add more files named `readme.md` in this folder. Prefer the topic as the filename so new coach-analytics notes can sit beside each other without colliding.

## Contents

| Doc                                                          | What it covers                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [anonymous-guest-tracking.md](./anonymous-guest-tracking.md) | Guest browsers on Coach: honest 7d metrics, identity stitch, dossier, history cohorts, heartbeat “now”, privacy disclosure, multi-window chart panel, shared bar notes |
