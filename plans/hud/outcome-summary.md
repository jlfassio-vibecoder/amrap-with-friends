# HUD Assessment Outcome Summary

## Outcome

The HUD is a sound subsystem with a strong core architecture and no immediate
need for a redesign.

Its current direction should be preserved:

- server-side telemetry aggregation
- strict client-side contract parsing
- pure domain logic in `src/lib/hud/`
- focused UI cards assembled by one page-level composition root

## Main Conclusion

The HUD's biggest challenge is not correctness of its overall shape. It is
managing growth around that shape.

The feature has outgrown its original epic and now needs stronger maintenance
structure around:

- current documentation
- SQL verification
- RPC evolution discipline
- page-level orchestration boundaries

## Top Gaps

1. The original HUD epic no longer describes the shipped subsystem closely
   enough to serve as the current source of truth.
2. `hud_telemetry` is carrying too many concerns in one SQL function, even
   though the single client-facing RPC remains the right external API.
3. Automated verification of the SQL contract lags behind the quality of the
   TypeScript-side tests.
4. `HUDPage` is approaching the point where more features should flow through a
   screen-level view-model layer instead of accumulating directly in the page.
5. HUD-adjacent hooks need stronger identity-change handling to avoid stale or
   cross-account data after auth transitions.

## Recommended Direction

### Keep

- one primary telemetry RPC
- server-side week/timezone bucketing
- defensive payload parsing
- domain logic outside components

### Improve Next

1. Maintain the HUD docs in `plans/hud` as the current implementation guide.
2. Add automated DB-level tests for `hud_telemetry`.
3. Update `supabase/scripts/verify_hud_telemetry.sql` so it matches the current
   payload shape.
4. Refactor the SQL internals behind the RPC if more telemetry fields are added.
5. Introduce a light screen-level data composition hook if `HUDPage` grows
   further.
6. Add direct hook and page-level integration tests, especially around account
   switching and `/hud` gating.

## Practical Read

If new HUD work is planned, the subsystem is safe to extend, but it should be
extended under tighter documentation and verification discipline than it has
today.
