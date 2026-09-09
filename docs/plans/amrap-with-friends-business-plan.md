# AMRAP With Friends — Business Plan

*Draft v1 — September 2026*

---

## 1. Executive summary

AMRAP With Friends (amrapwithfriends.com) is a standalone web app for running synchronized AMRAP missions with friends in real time: plan or join a mission, sync the clock, log rounds together, and lock a score at the finish. It also ships AMQAP — continuous I1 mobility flows — for recovery days.

The app is live with a mostly free user base. This plan converts that base into a subscription business on three tiers (Athlete, Coach, Gym), builds distribution through an influencer program where the *mission room itself* is the referral mechanism, and runs a social plan that turns every finished mission into content.

**One-line thesis:** Most timer apps are solo tools. AMRAP With Friends is a multiplayer game loop wrapped around a workout — and multiplayer products grow through the people who host the room.

**12-month targets (base case)**

| Metric | Month 3 | Month 6 | Month 12 |
| ------ | ------- | ------- | -------- |
| Monthly active athletes | 2,500 | 6,000 | 15,000 |
| Paid Athlete subs | 125 (5%) | 420 (7%) | 1,350 (9%) |
| Active Coach subs | 15 | 60 | 200 |
| Gym locations | 0 | 3 (pilot) | 15 |
| MRR | ~$1,300 | ~$5,300 | ~$18,000 |

These assume no paid ads; growth is influencer-led and organic. See §7 for the model.

---

## 2. Product

### What exists today (from the current build)

- **Missions** — create (`/create`) or join, real-time synced timer, shared round logging, score lock at finish via `submit-participant-result`.
- **Workout sources** — Custom, Choose from library, Coach WODs, and **AMQAP** (5 mobility families × 10/15 min).
- **Exercise library** with How-to modals (setup, mistakes, cue) and scaling ladders.
- **Guest-first play** — anyone can join and finish a mission without an account, then claim it to their account after sign-in. This is the single most important growth feature in the product and the whole influencer program is built on it.
- **Auth** — email/password live; magic link, password reset, and Google OAuth are flag-gated behind SMTP setup.
- **Rally points / lobby schema** in Supabase with RLS and RPCs.

### What the business model needs from the product (build order)

1. **Referral + attribution layer** (§5) — referral codes, mission-based attribution, "home coach" on the athlete profile.
2. **Stripe billing** with 6/12-month plans and coupon support.
3. **Coach dashboard** — mission history for their squad, recurring missions, squad leaderboard.
4. **Share card** at mission finish — auto-generated image (score, rounds, squad names, coach handle) for Stories/Reels. This is the content engine for §8.
5. **Gym mode** (phase 2) — location-level account, member roster, kiosk/TV display for the synced clock, individualized scaling per member.

Ship 1, 2, and 4 before pushing influencer recruitment hard. Without 4, every influencer post is manual work for them.

---

## 3. Market and customers

### Segments

| Segment | Who | Pain | What they pay for |
| ------- | --- | ---- | ----------------- |
| **Athlete** | Recreational CrossFit / HIIT / garage-gym athletes who train with a partner or remote group | Solo timers are lonely; group chats can't sync a clock or keep score | Pro features, history, leaderboards, AMQAP recovery |
| **Coach / Host** | Online coaches, group-fitness instructors, run-club style organizers with 10–500 followers who train together | No lightweight way to run a live workout for a remote group without Zoom + spreadsheet | Hosting tools, squad tracking, branded missions, and revenue share |
| **Gym** (phase 2) | CrossFit boxes, functional-fitness studios, bootcamps | Whiteboard scoring is manual; members want individualized scaling and a record | Location license, TV clock, member accounts |

### Why now

- Social fitness (Strava clubs, Peloton leaderboards, Zwift) proved people will pay to train *with* others asynchronously. Live-synced group AMRAPs are an open lane.
- Creator-led fitness is mature but tooling for creators is Zoom, Discord, and PDFs. A creator who can say "join my mission at 6pm" with one link has something new to sell to their audience.
- AMQAP gives the product a reason to be opened on rest days — retention, not just intensity.

### Competitive frame

| | Solo timers (SmartWOD, Seconds) | Community platforms (Strava, WHOOP teams) | Coach platforms (TrueCoach, Trainerize) | AMRAP With Friends |
| - | - | - | - | - |
| Live synced clock | No | No | No | **Yes** |
| Real-time shared scoring | No | No (post-hoc) | No | **Yes** |
| Guest can play without account | Sometimes | No | No | **Yes** |
| Creator revenue share | No | No | No | **Yes** |
| Price to athlete | Free–$5/mo | $12/mo | N/A (coach pays $20–50/mo) | Free / ~$6/mo eff. |

The moat isn't the timer. It's the mission-room network: every hosted mission is a live acquisition event.

---

## 4. Pricing

### Principles

- **Anchor on monthly equivalent, sell the term.** Show "$5.83/mo" in big type, "billed $69.99/year" underneath. Same logic as a lease payment — the monthly number is what people compare.
- **Annual should be a no-brainer vs. monthly (≥40% off); 6-month is the on-ramp (≈25% off).** Two term options plus a monthly reference point is enough. More SKUs = fewer decisions made.
- **Free stays useful forever for solo and joining.** Paywall hosting depth, history, and leaderboards — not participation. Guests joining an influencer's mission must never hit a wall.
- **Coach tier is priced as a business tool, not a consumer app.** Coaches earn revenue share, so the tier pays for itself at ~2 referred annual subs.

### Athlete plans

| Plan | Price | Effective / month | Discount vs monthly | Positioning |
| ---- | ----- | ----------------- | ------------------- | ----------- |
| Free | $0 | — | — | Join any mission, host up to 3 missions/month (max 5 participants), AMQAP 10-min flows, 30-day history |
| Athlete Pro — Monthly | $9.99/mo | $9.99 | reference only | Shown for comparison; not promoted |
| **Athlete Pro — 6 month** | **$44.99** | **$7.50** | 25% | Default selection on the pricing page |
| **Athlete Pro — 12 month** | **$69.99** | **$5.83** | 42% | "Best value" badge; the target SKU |

**Athlete Pro includes:** unlimited hosting and participants, full history and PRs, all leaderboards (Raw, Weight-, Age-, Gender-Adjusted), all AMQAP flows (10 + 15 min), scaling presets saved per exercise, mission chains, share cards without watermark.

**Launch offer (first 90 days):** Founding Athlete — 12 months for $49.99 ($4.17/mo), lifetime price lock. Use this to convert the existing free base, then retire it.

### Coach / Host plans

| Plan | Price | Effective / month | Discount |
| ---- | ----- | ----------------- | -------- |
| Coach — Monthly | $24.99/mo | $24.99 | reference |
| **Coach — 6 month** | **$119.99** | **$20.00** | 20% |
| **Coach — 12 month** | **$199.99** | **$16.67** | 33% |

**Coach includes everything in Athlete Pro plus:** branded mission rooms (handle, avatar, colors), scheduled and recurring missions, squad roster and squad leaderboard, Coach WOD library publishing, referral code + mission attribution, revenue-share dashboard and payouts, up to 3 co-hosts.

**Coach is free for the first 12 months to accepted Founding Coaches** (§5). The revenue share is worth more than the subscription; don't let $200 be the reason a good creator doesn't join.

### Gym plans (phase 2 — validate with 3 pilot gyms before publishing)

| Plan | Price | Effective / month | Discount |
| ---- | ----- | ----------------- | -------- |
| Gym — Monthly | $99/mo per location | $99 | reference |
| **Gym — 6 month** | **$499** | **$83.17** | 16% |
| **Gym — 12 month** | **$899** | **$74.92** | 24% |

**Gym includes:** unlimited coaches at the location, member roster (up to 300; +$0.25/member/mo beyond), TV/kiosk clock mode, per-member scaling profiles, class-level leaderboards, whiteboard export. Members get Athlete Pro features while inside the gym's missions; if they want Pro outside the gym, they buy it (or the gym buys seats at $3/member/mo).

Sanity check against your lease-math instincts: a box with 150 members paying ~$175/mo has ~$26k MRR. $75/mo is 0.3% of revenue — well under the threshold where an owner needs to think about it. Price is not the objection; setup time is. Onboarding has to be under 30 minutes.

### Billing mechanics

- Stripe Checkout + Customer Portal. Auto-renew on all terms; email 7 days before renewal.
- Refund policy: 14 days, no questions. Revenue-share payouts hold 30 days to clear this window.
- Coupons are a first-class object (influencer codes ride on them — §5).
- Grandfather pricing for anyone on a term when you raise prices. Raise list prices once a year, not more.

---

## 5. Influencer / Coach revenue-share program

### Design goals

1. Attribution must work **without the athlete typing a code**, because most joins will come from a shared mission link, not a bio link.
2. Athletes must have a reason to *want* to be attached to an influencer, not just be tagged by accident.
3. Payouts must be simple to explain in one sentence and impossible to game with self-referrals.

### Attribution (two paths, one record)

Every athlete profile gets one **`home_coach`** field (nullable, coach user id) and an **`attributed_at`** timestamp.

| Path | How it's set | Window |
| ---- | ------------ | ------ |
| **Link / code** | `amrapwithfriends.com/@handle` or `?ref=CODE`, or code entered at checkout. First-party cookie + stored on guest session. | 60 days from click to paid conversion |
| **Mission-based** | Guest joins a mission hosted by a Coach-tier user → session tagged with host id. When the guest claims the mission to a new account, `home_coach` is set to that host **if the athlete confirms** (see incentive below). If they already have an account with no home coach, same prompt. | Set at claim; applies to any purchase in the next 60 days |

Rules:

- **Last touch wins** between the two paths, but a home coach already set is not overwritten silently. The athlete can change their home coach from Settings once per 90 days.
- A referral is only **commissionable** if the athlete converts to a paid plan (any term) within the window. Free users generate no payout, but they do count toward the coach's squad size and tier.
- Self-referral, same payment instrument, or same device fingerprint → not commissionable. Coach accounts can't be their own home coach.

### Why an athlete attaches to a coach (the incentive side)

At claim time the prompt is not "Were you referred?" — it's a choice with visible value:

> **Train with @handle?**
> - 14-day Athlete Pro trial (instead of 7)
> - 15% off your first 6- or 12-month plan
> - Access to @handle's Coach WOD library and squad leaderboard
> - "Trained with @handle" badge on your share cards

Ongoing reasons to stay attached:

- The squad leaderboard and squad-only missions live behind the attachment.
- Milestone unlocks tied to the squad: "Squad hit 1,000 rounds this month → everyone gets +1 free month."
- Your home coach sees your finishes in their dashboard and can react/comment. That social loop is the retention mechanism, and it's what a Strava kudos does for free.

### Revenue share tiers

Commission is on **net revenue** (list price minus discounts, Stripe fees, refunds, and sales tax). State this in the terms so there's no ambiguity when a coach sees $69.99 and expects 30% of $69.99.

| Tier | Qualifying paid referrals (rolling 12 mo) | Share of net, first 12 months of each referred sub | Renewal share (months 13+) | Extras |
| ---- | --------------------------------------- | -------------------------------------------------- | -------------------------- | ------ |
| **Starter** | 1–24 | 25% | 10% | Coach tier free for 12 months (Founding Coaches) |
| **Builder** | 25–99 | 30% | 15% | Custom `/@handle` landing page, early feature access |
| **Partner** | 100–299 | 35% | 20% | Co-branded missions on the AWF social channels, quarterly call |
| **Anchor** | 300+ | 40% | 25% | Negotiated; potential equity/advisor discussion for the top 2–3 |

Worked example at Builder tier: an athlete buys a 12-month plan at $69.99, uses the 15% attached-athlete discount ($59.49), Stripe takes ~$2.03, net ≈ $57.46. Coach earns **$17.24** on that sale, and if the athlete renews, **$8.62** the next year. 100 such referrals ≈ $1,700 in year one plus ~$860/yr trailing.

Gym referrals: flat **20% of the first-year gym contract** to whoever brings in the location (one-time), because the gym relationship will be owned by you, not the referrer.

### Payout mechanics

- Stripe Connect Express accounts; coach onboards once, W-9/W-8 collected by Stripe.
- Paid monthly on the 15th for the prior month, 30-day hold on each transaction to clear refunds.
- $25 minimum payout; balance rolls forward.
- Dashboard shows: clicks, mission joins, claims, conversions, pending, paid, tier progress.

### Founding Coaches program (first 90 days)

Recruit **20 coaches** by hand. Target profile: 2k–50k followers, already runs group workouts (IG Lives, Discord, run clubs, garage-gym crews), engaged comments, not already locked into a coaching platform.

They get: Coach tier free 12 months, Builder-tier rates from day one regardless of volume, a personal onboarding call, a launch kit (share cards, a 30-second explainer clip, mission templates), and their handle on the "Founding Coaches" wall on the site.

They commit to: hosting ≥1 public mission per week for 8 weeks, and posting the finish share card.

Twenty coaches × 1 mission/week × ~15 joins = ~1,200 guest sessions a month. At a 20% claim rate and 7% paid conversion of claimed accounts, that's ~17 paid subs/month from the program alone at month 3, compounding as squads grow.

---

## 6. Go-to-market phases

| Phase | Window | Focus | Exit criteria |
| ----- | ------ | ----- | ------------- |
| **0 — Foundation** | Sep–Oct 2026 | Stripe billing, referral/attribution layer, share cards, coach dashboard v1 | A coach can host, an athlete can join as guest, claim, attach, buy, and the coach sees a payout line |
| **1 — Founding Athletes + Coaches** | Oct–Dec | Convert existing free base on the $49.99 founding offer; onboard 20 Founding Coaches; start the weekly "Monday Mission" (§8) | 20 active coaches, 150+ paid athletes |
| **2 — Open program** | Jan–Mar 2027 | Public affiliate signup, tier ladder live, Google OAuth on, magic link on, mobile PWA polish | 60 coaches, 400+ paid, referral share of new paid ≥ 50% |
| **3 — Gym pilot** | Feb–May 2027 | 3 pilot gyms (free 90 days), build TV mode + roster from their feedback | 2 of 3 convert to paid; onboarding ≤ 30 min |
| **4 — Gym launch + scale** | Jun–Sep 2027 | Publish gym pricing, gym referral bounty, first paid acquisition tests | 15 locations, $18k MRR |

---

## 7. Financial model (base case)

### Assumptions

- Existing free base converts at 4% on the founding offer in phase 1.
- Ongoing: 20% of guest mission sessions claim an account; 7% of accounts go paid within 60 days; 65% of paid pick 12-month, 25% 6-month, 10% monthly.
- Blended athlete ARPU ≈ $6.40/mo after discounts and fees. Annual churn on 12-month plans 35%; on 6-month 45%.
- Blended influencer commission load ≈ 22% of athlete net revenue (mix of tiers and non-attributed sales).

### Cost structure (monthly, steady state)

| Line | Month 3 | Month 12 |
| ---- | ------- | -------- |
| Supabase (Pro + compute) | $75 | $250 |
| Vercel Pro | $20 | $20 |
| Stripe fees (2.9% + $0.30, blended) | ~$60 | ~$700 |
| Email (Resend) | $20 | $20 |
| Influencer payouts | ~$250 | ~$3,500 |
| Content tooling (Canva/CapCut/scheduling) | $50 | $50 |
| Contract video editor (phase 2+) | — | $800 |
| **Total** | **~$475** | **~$5,340** |

Founder time is the real cost and is not in this table. At $18k MRR and ~$5.3k costs, the business clears ~$12k/mo before founder pay — enough to justify a part-time community/content hire in month 12–15.

### What would break the model

- **Claim rate < 10%.** If guests finish missions and don't claim, nothing downstream works. Instrument this first; the claim prompt and the share card are the two levers.
- **Coaches host once and stop.** Weekly hosting is the engine. The Founding Coach commitment and the recurring-mission feature exist to fix this.
- **Annual mix < 50%.** If people default to monthly, ARPU and churn both go the wrong way. Keep monthly visually de-emphasized; never run promos on it.

---

## 8. Social media plan

### Strategy in one line

Every finished mission produces a share card. The share card is the ad. Our job is to make it worth posting and to build rituals that produce more of them.

### Channels and roles

| Channel | Role | Cadence |
| ------- | ---- | ------- |
| **Instagram** (Reels + Stories) | Primary. Coaches live here; share cards are Story-native | 5 Reels/wk, daily Stories |
| **TikTok** | Reach. Repost Reels natively, plus TikTok-only "watch a squad race the clock" clips | 5/wk (mostly cross-posts) |
| **YouTube Shorts + 1 long-form/mo** | Search and durability. Long-form: "how we built a live multiplayer timer" build-in-public | 3 Shorts/wk, 1 long/mo |
| **X / Threads** | Build-in-public, founder voice, dev community | 3–5 posts/wk |
| **Discord (or a Coach WhatsApp)** | Coach community, not public marketing | Ongoing |

Skip Facebook pages and LinkedIn for phase 1. Revisit LinkedIn for the gym tier only.

### Content pillars (weekly mix)

| Pillar | Share | Example |
| ------ | ----- | ------- |
| **Mission finishes** | 40% | Share cards and screen-recorded final 30 seconds of a squad race; reposted from coaches and athletes. UGC-first — the account is a highlight reel of other people. |
| **Rituals** | 20% | "Monday Mission" (weekly public AMRAP, same time every week, live leaderboard), monthly benchmark mission with a named leaderboard |
| **Coach spotlights** | 15% | 30–60s intro of a Founding Coach + their signature WOD + "join their next mission" link |
| **AMQAP / recovery** | 15% | Calm, slow B-roll of a flow; counter-programming to the race content; performs well on rest days (Sundays) |
| **Build-in-public** | 10% | Founder clips: what shipped this week, a pricing decision, a leaderboard-math explainer. Your lease-sales background is a differentiator here — talk about pricing openly. |

### Formats that fit the product

- **"Race the clock" screen capture** — the synced timer, round counts ticking up for each name, last 20 seconds. No talking needed; native sound.
- **Split-screen** — coach on the left doing the workout, timer + leaderboard on the right.
- **Share card carousel** — 5 finishes from one mission, swipe through.
- **"Scale it" clips** — one movement, three scaling rungs from the exercise ladder, 15 seconds.
- **Before/after leaderboard** — Raw vs Age-Adjusted board for the same mission; a 50-year-old winning on the adjusted board is a story people share.

### Rituals (these matter more than the posting calendar)

1. **Monday Mission** — one public mission, hosted by rotating Founding Coaches, same time every week (pick one US-evening slot; add a second EU/SG slot when there's demand). Leaderboard posted Tuesday morning.
2. **Benchmark of the Month** — first Saturday, same workout each year, so year-over-year PRs become a thing.
3. **Squad Wars** (quarterly) — coaches' squads compete on total rounds for a month; winning squad gets a free month for everyone. Drives attachment (§5).

### 90-day calendar

| Weeks | Theme | Key moves |
| ----- | ----- | --------- |
| 1–2 | Set up | Rebrand handles, bio link to `/@handle` pattern, 10 share-card templates, film 20 evergreen clips in one day |
| 3–4 | Founding Athletes | Push the $49.99 founding offer; "we're opening the doors" story; first Monday Mission |
| 5–8 | Founding Coaches | One coach spotlight every 3 days; each coach's first mission gets a co-post |
| 9–10 | Benchmark #1 | Named benchmark mission; leaderboard content for a week |
| 11–12 | Squad Wars #1 | Month-long, announce standings weekly; finishes with a winners post |
| 13 | Retro | What worked; publish the numbers (build-in-public) |

### Metrics

| Metric | Target by day 90 |
| ------ | ---------------- |
| Share-card posts by users (tracked via UTM on card) | 300/mo |
| Follower → mission join rate on link clicks | 25% |
| Monday Mission participants | 100 |
| Reels with ≥ 5k views | 8 |
| New paid subs attributed to social (non-coach) | 40 |

### Operating rhythm

- **One filming day per month** for evergreen; everything else is screen capture and UGC.
- Coaches get a monthly content kit: 3 share-card variants, next Benchmark details, a 15-second app clip they can stitch.
- Repost every athlete share card that tags the account. Reply to every comment for the first 90 days. This is cheap now and impossible later.

---

## 9. Risks and mitigations

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Influencers treat it as a one-off post, not a habit | High | Weekly hosting commitment, recurring missions, share cards remove friction, renewal share keeps them invested |
| Attribution disputes between coaches | Medium | Athlete-controlled home coach, 90-day change lock, transparent dashboard |
| Free tier is too generous → nobody upgrades | Medium | Hosting caps and history window are the levers; adjust after 60 days of data, never remove joining |
| Copycat feature from a large timer app | Low–Med | Network (coaches + squads) and revenue share are the moat, not the clock |
| Supabase real-time cost at scale | Low | Missions are short and bursty; monitor connection-hours, add regional pooling if needed |
| Regulatory: affiliate disclosure | Certain | Terms require FTC-compliant disclosure (#ad / "I earn a share"); provide the copy in the kit |

---

## 10. Immediate next steps (next 30 days)

1. Instrument the funnel: guest session → claim → paid, with host id carried through.
2. Stripe: create the 6 SKUs above plus the Founding Athlete coupon.
3. Build `home_coach` + referral code + Connect onboarding.
4. Ship the share card at mission finish.
5. Write the Founding Coach one-pager and DM the first 20.
6. Schedule the first Monday Mission.

---

*Not legal, tax, or financial advice. Revenue-share terms, affiliate disclosures, and the sole-proprietor payout setup are worth a review with a CPA and an attorney before the program goes public.*
