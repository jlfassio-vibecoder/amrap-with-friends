# Room reminders — choosing the trigger

_Companion to [the Phase 2b work](coach-rooms-roadmap.md#4-phase-2--the-return-loop) ·
11 September 2026_

`/api/room-reminders/send` is deliberately **trigger-agnostic**. It authenticates
a caller with `CRON_SECRET`, claims whatever is due, sends it, and returns. It
does not care what woke it or how punctually.

That is a property of the claim design, not an accident. Because
`claim_due_room_reminders` uses open-ended windows ("scheduled within the next
hour") rather than narrow ones ("between 23h55 and 24h05"), a **late** trigger
only delays a reminder. It never duplicates one — the ledger's primary key
guarantees that — and it never drops one, because the window is still open on
the next run. A narrow window would have made punctuality a correctness
requirement and ruled out every free option below.

**Decided: option 1.** The project is on Vercel Pro, and `crons` in
`vercel.json` is the only option where the schedule is version-controlled next
to the route it triggers. The rest of this file is kept because the reasoning
still applies if that ever has to change -- and because the granularity table
is the thing to check before substituting any other trigger.

The first attempt shipped the same block before the upgrade and Vercel rejected
the deployment: sub-daily cron is a Pro feature, and the failure link goes
straight to the cron pricing page. Worth knowing as the symptom, because the
error does not say which line of `vercel.json` it objected to.

## What the granularity has to be

The 1h reminder is the one with a deadline. A trigger running every `N` minutes
sends it somewhere in the window `[1h - N, 1h]` before the mission, so:

| Interval | 1h reminder arrives | Verdict                              |
| -------- | ------------------- | ------------------------------------ |
| 1 min    | 59–60 min before    | Ideal                                |
| 5 min    | 55–60 min before    | Fine — nobody notices five minutes   |
| 15 min   | 45–60 min before    | Acceptable                           |
| Daily    | Useless             | The reminder fires at the wrong time |

Anything at or under 15 minutes works. Daily does not, which is why the Hobby
plan's cron cannot run this feature by itself.

## Options

### 1. Vercel Pro — `crons` in `vercel.json` (chosen)

The block now in `vercel.json`:

```json
"crons": [{ "path": "/api/room-reminders/send", "schedule": "* * * * *" }]
```

Simplest and the most honest fit: the schedule lives in version control next to
the route it triggers, the auth header is supplied by Vercel, and there is no
second system to keep alive. Costs a plan upgrade.

### 2. GitHub Actions on a schedule — free

A workflow that `curl`s the route with the `CRON_SECRET` as a repository
secret. GitHub's minimum is every 5 minutes and runs can be delayed under load,
sometimes by a lot. Per the table above, 5 minutes is fine and lateness is safe
— this is the option the claim design was written to permit.

The real caveat is that scheduled workflows are **disabled automatically after
60 days of repository inactivity**, and the symptom is reminders silently
stopping. Anything relying on this needs a check that notices.

### 3. An external cron service — free tier

cron-job.org and similar will hit a URL every minute with a custom header. No
plan upgrade, no repository-inactivity trap, but it is a third-party service
holding a secret that can send mail as the product, and one more account for
whoever inherits this.

### 4. `pg_net` + `pg_cron` inside Supabase

Considered and set aside during Phase 2b. It needs an extension this database
has never used and a service-role key stored inside the database that key
unlocks. Worth revisiting only if the Vercel route turns out to be the wrong
home for other reasons.

## If this ever has to change

Options 2 and 3 stay viable without a plan change, because the claim design
tolerates a late trigger. Check the granularity table first: anything at or
under 15 minutes is fine, and daily is not a smaller version of this feature but
a broken one.

Whichever is chosen, the route needs `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `REMINDER_FROM_ADDRESS` and `REMINDER_TOKEN_SECRET` in Vercel,
and `supabase db push` for the migration. Until a trigger is wired up, nothing
sends — the route is deployed and idle, which is a safe place for it to sit.
