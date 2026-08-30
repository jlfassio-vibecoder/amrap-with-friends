AMRAP With Friends · campaign programming

Benchmark Backlog
Four items Slice D left on the table. Decisions locked in the motivation brief
(2026-08-30): E then C ship as code; B is not a Standings column; A stays A3.

Branch claude/landing-page-update-uawasu
Slice D shipped (The test on campaign detail).

Order of play
E → C → observe how athletes use The test vs Standings → maybe lead with delta later.
A stays content-gated. B-as-Standings-column is rejected.

E
Freeze the benchmark library
Shipped — `benchmarkFingerprints.ts` + CI assert + CLAUDE note.
Canonical fingerprint strings of score-affecting fields only. Escape hatch: new
template id, retarget the table, update fingerprints in the same commit.

C
Measurement-track picker
Shipped — “Measured on this” / “Measure on this” on create; plan line
“Measured on {label}.” `tracks[0]` remains the measurement track. Never label
the control “Benchmark.”

B
Delta as a Standings column
Rejected. Delta is not rankable beside normalised average; mixed units; late
joiners look broken in a ranked table.

Evidence still open (observe, do not code yet)
Do people scroll to “The test”, or stop at Standings?
- If The test wins → later merge should lead with personal delta, not add a
  Standings Change column.
- If Standings wins → improve The test hierarchy/empty states first.
Gather this on a few campaigns with a scored benchmark and at least one retest.

A
Tier variants
A3 — leave until a coach commissions authored ladders (A1). Do not build
derived scaling (A2).
