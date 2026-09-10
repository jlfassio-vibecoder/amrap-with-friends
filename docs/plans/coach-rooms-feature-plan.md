# **Coach's Rooms — feature plan, revision 2**

*AMRAP With Friends · 10 September 2026*

Revised from the proposed plan. The change log at the end lists every substantive edit and why. Part B assesses how this compares to what's already on the market.

---

## **Part A — Revised plan**

### **1\. Product purpose**

A Coach's Room is a persistent home on AMRAP With Friends where a coach or gym brings a community together to train, track progress, and keep coming back, wherever each member is.

The promise: **Train with your coach's community, wherever you are.**

The room packages what the business plan already proposes — branded rooms, recurring missions, workout publishing, standings, co-hosts, referral earnings — into one repeatable loop:

**Discover the room → finish a mission → join the room → get reminded → return for another mission → get recognized.**

Out of scope: client administration, appointments, nutrition, private coaching plans, gym membership billing, paid admission to rooms.

### **2\. Vocabulary**

Fix these before any code, because the marketing pages already use some of these words loosely.

| Term | Meaning | Where it appears |
| ----- | ----- | ----- |
| **Room** | The coach's persistent community. One host account owns one room (v1). | Product and marketing. This is the word coaches see. |
| **Mission** | One workout with a synced clock. Can belong to a room or to nobody. | Product. |
| **Campaign** | A finite multi-week series of missions inside a room (already live). | Product. |
| **Squad** | An athlete's personal friends list. Not the room. | Product only. |
| **Home coach** | The single coach an athlete's purchases are attributed to (referral record). | Product and program terms. |

The current coaches landing page says "your squad" where it means "your room." Update that copy. Being in a room never adds anyone to anyone's squad.

### **3\. Ownership and membership**

**Host account** — a lightweight entity that owns the room, the subscription, and the entitlements. It can represent one person or a gym.

* One host account → one room (v1). One owner manages billing and settings.  
* Up to three **co-hosts** can publish workouts, schedule and run missions, react to finishes, and pin the announcement. Co-hosts cannot change billing, transfer ownership, delete the room, remove the owner, or see referral earnings. Revoking a co-host takes effect immediately, including inside a running mission (they drop to participant).  
* Athletes join any number of rooms with one account. Personal history stays with the athlete.  
* **Handles** are unique, lower-case, 3–24 chars, reserved list (`admin`, `support`, `coach`, existing route names). Changing a handle keeps a 90-day redirect from the old one. Handles are never reissued to a different host within 12 months of release.

Add multi-room hosts and location hierarchies only if gym pilots ask for them.

### **4\. The athlete experience**

Room address: `/@handle`, backed by a stable `room_id`. The page answers, in this order: **Who am I training with? What can I do next? Why come back?**

The room page contains:

* **Identity** — name, avatar, restrained brand (color pair), one-paragraph intro, who the workouts suit, equipment usually needed.  
* **Next mission** — workout, start time in the *viewer's* timezone, equipment, scaling, one join button. If the athlete is signed in, an "Add to calendar" (ICS) link and a reminder toggle.  
* **This week's workout** — the room's published workout, completable on the athlete's own schedule before the weekly window closes.  
* **Room activity** — opt-in recent finishes ("Maya finished 7+12 · Tuesday's room"), coach reactions, and the pinned announcement.  
* **Workout collection** — the coach's published workouts, each launchable as a personal mission.  
* **Current campaign** — if one is running, with weeks remaining.

**Where it renders.** The room page lives in the app (Vite), because "next mission" is live state and "join" needs the mission engine. The Astro marketing site gets a prerendered `/@handle` shell with OG tags that redirects into the app; regenerate it on a handle or branding change. Don't build the room page twice.

**Guest → member flow.** A guest who finishes a room mission sees one post-finish sheet, in this order:

1. **Share** (card/replay — already designed).  
2. **Save your result** — creates the account and claims the mission. Default action.  
3. **Join @handle's room** — a checkbox on the same sheet, on by default, with a one-line "what the coach can see" note. Unchecking it never blocks saving.

Setting a **home coach** rides on the same checkbox: joining a room sets the home coach *if the athlete doesn't have one*. If they already have one, the room is joined and the home coach is unchanged; the sheet says so. This keeps the three records (result, membership, attribution) separate in the database while showing the athlete one decision, not three prompts.

Joining a room requires an account. Reading a public room page does not.

### **5\. Participation between live missions**

Live missions stay the signature experience; the room has to be worth opening when the coach is offline.

Two actions, named consistently everywhere:

* **Train together** — join the scheduled synced mission.  
* **Train on your time** — complete this week's published workout before its window closes (window default: Monday 00:00 → Sunday 23:59 in the room's timezone).

"Train on your time" creates a personal mission linked to the room's `workout_publication`. Never drop someone into a finished live mission.

**Standings rules (decide once, display everywhere):**

* Live and independent completions appear in the same weekly activity list, labeled.  
* Standings only combine completions of the same workout version with the same scoring rule and scaling tier. Different scaling tiers are separate lists, not a penalty.  
* Standings use the **first** attempt of the week. Personal history keeps the best.  
* v1 recognition is completion and consistency: "finished this week," "3 weeks running," "second mission with this room." Adjusted rankings (age, weight) are already built for Pro and can be surfaced in rooms later; they are not needed to prove the loop.

**Reminders (new).** The return loop needs a nudge or it's a page people forget. v1: an email 24h and 1h before a scheduled mission to members who opted in, plus the ICS link. Email only (Resend is already planned for auth). Push/SMS later.

### **6\. The coach experience**

A room dashboard with a short list of actions:

* Publish a workout or repeat last week's (one tap: "Run this again next Tuesday").  
* Schedule the next mission; set the weekly workout.  
* Start or manage a campaign.  
* Copy the invite link.  
* See who finished this week and who came back ("Eight finished; three completed their second mission").  
* React to a finish (small fixed set of reactions).  
* Pin one announcement.  
* Manage co-hosts and members (remove, not ban — no moderation tooling yet).  
* See referral earnings (owner only) — the existing program dashboard, embedded.

Coaches see only activity that happened in their room. Not a member's other rooms, personal missions, profile details, or platform analytics. This is a **new** customer dashboard, not the existing `/coach` area: that area is gated by the `coach_users` allowlist and carries web and conversion analytics for the platform owner. Paying hosts never receive that role.

No chat, DMs, or video in v1. Announcement \+ reactions \+ the mission itself is enough to test repeat training.

### **7\. Subscription and entitlements**

**Charge the host for running the community. Participation stays free.**

Three separate things, never conflated:

| Access | Who pays | What it unlocks |
| ----- | ----- | ----- |
| **Room subscription** (Coach plan) | Host | Branding, publishing, scheduling, co-hosts, room dashboard, reminders |
| **Athlete Pro** | Athlete | Personal features everywhere: full history, adjusted boards, all AMQAP flows, clean share cards |
| **Referral attribution** | Nobody | A financial record; independent of both |

A free athlete can join a room, do its workouts (live and on their time), see their results and basic room standings, and get reactions and reminders. The host's plan supplies what the *room's* workouts need; it does not grant members Pro outside the room.

Gym rooms work wherever the member trains. Access is tied to room activity, never to being at the facility.

Pricing: the business plan's $24.99/mo · $119.99/6-mo · $199.99/yr is the pilot hypothesis, not validated willingness to pay. Founding hosts get 12 months free through an explicit **entitlement row** with `source = 'founding'` and an `expires_at`, never a flag on the account.

No per-member billing in v1. No paid admission to rooms.

**Referral accounting starts in phase 1, payouts start in phase 4\.** The attribution records (home coach set, eligible purchase, amount, date) must be written from the first pilot mission, or founding hosts' early commissions are lost. Paying them can be manual for the pilot; the ledger cannot be.

### **8\. Technical implementation**

Existing shared Supabase database, room-scoped authorization in RLS and RPCs.

**New tables (sketch):**

host\_accounts        id, owner\_user\_id, kind ('coach'|'gym'), name, created\_at  
rooms                id, host\_account\_id, handle (unique, citext), display\_name, avatar\_path,  
                     brand jsonb, intro text, timezone, visibility ('public'), created\_at  
room\_handle\_history  room\_id, old\_handle, expires\_at  
room\_members         room\_id, user\_id, role ('owner'|'cohost'|'member'), joined\_at, left\_at,  
                     reminders\_enabled bool, activity\_visible bool  
room\_invites         room\_id, token, created\_by, expires\_at, uses  
workout\_publications room\_id, workout\_snapshot\_id, week\_start date, window\_end timestamptz,  
                     scoring\_rule, published\_by  
room\_reactions       room\_id, participant\_result\_id, by\_user\_id, reaction, created\_at  
room\_announcements   room\_id, body, pinned\_by, updated\_at   (one row per room)  
entitlements         host\_account\_id, feature ('room'), source ('stripe'|'founding'|'pilot'),  
                     starts\_at, expires\_at, stripe\_subscription\_id  
referral\_ledger      athlete\_user\_id, coach\_user\_id, event ('attributed'|'purchase'|'refund'),  
                     amount\_net\_cents, tier\_share, occurred\_at, stripe\_invoice\_id

Add `room_id` (nullable) to `missions` and `campaigns`. Personal missions keep `room_id = null`. Scheduled-mission generation copies `room_id` and the room's access rules onto every generated mission.

**Authorization rules to write as policies, not just UI:**

* Room membership grants read on room pages, publications, activity, and standings. It does **not** grant read on a specific mission's live participant rows; that stays with mission participation.  
* Owner and co-host writes are checked against `room_members.role` on the row's `room_id`.  
* Co-hosts never match `coach_users`. Grep every use of that allowlist before shipping.  
* Workout publishing: the existing authoring path checks the platform coach role. Add a parallel check for `room_members.role in ('owner','cohost')` scoped to the target room; do not widen the platform role.  
* Entitlements are maintained only from verified Stripe webhook events (idempotent on `event_id`). Returning from checkout shows a "confirming" state until the webhook lands.

**Reuse:** mission engine, guest claiming, campaign scheduling, workout snapshots, share cards and replay, the referral cookie and `home_coach` field. Share cards for room missions carry the room handle and brand.

**Timezones:** store scheduled starts as `timestamptz`; store the room's IANA timezone for "weekly window" math; display in the viewer's timezone.

### **9\. Privacy and lifecycle rules**

* Joining a mission does not join a room. Joining a room does not join anyone's squad.  
* Membership changes never move referral commissions. Leaving a room does not clear a home coach.  
* Co-host access never includes platform analytics or referral earnings.  
* Passing mission command to a co-host does not transfer room ownership or billing.  
* Leaving a room ends future access; personal results stay with the athlete. The room's historical standings keep the athlete's finished results under their visibility setting.  
* Cancellation: paid access runs to term end, then the room becomes read-only (page and history stay up, no new missions or publications, scheduled generation stops, reminders stop). Reactivation restores everything.  
* A mission in progress always finishes, through any subscription transition.  
* Room pages and share cards obey each participant's `share_visibility` and `activity_visible` settings.  
* Rooms are public with explicit membership opt-in. Invite-only rooms wait for a pilot host to need one.  
* Removing a member is immediate and not notified (v1); banning and reporting are not built.

### **10\. Delivery sequence**

**Phase 1 — Room boundary \+ ledger.** Host accounts, rooms, handles and redirects, memberships and roles, entitlements with founding expiry, RLS and RPCs, the referral ledger, the new dashboard shell separated from `/coach`. No UI polish.

**Phase 2 — Return loop.** Room page (app) \+ Astro OG shell, next mission and "run again," guest-to-member sheet, workout collection, reminders, activity list, reactions, announcement. Room-branded share cards.

**Phase 3 — Train on your time.** Weekly publication window, personal missions linked to publications, compatible standings, campaign integration.

**Validate with 3–5 founding hosts** before phase 4\. Each host publishes a first mission and a scheduled next one within a week of onboarding. Expand recruitment only after seeing second-mission returns.

**Phase 4 — Monetization automation.** Stripe checkout, portal, renewals, cancellation → read-only, Connect payouts driven by the ledger that's been accumulating since phase 1\.

Gym-specific work follows evidence from gym rooms being used between visits.

### **11\. Success criteria and release checks**

**Primary:** athletes who complete a second mission with the same host within 14 days.

**Secondary:** hosts who schedule a second mission within 14 days of their first; guest finish → claim rate; member return rate week over week; "train on your time" completions per published workout; reminder opt-in rate; minutes for a host to schedule the next mission. Keep guest and claimed-account counts separate; never fabricate identity matches.

**Release checks:** cross-room data isolation (member of A cannot read B), co-host revocation mid-mission, guest claim into an existing account, timezone correctness across a DST boundary, duplicate independent completions in one window, subscription expiry during a scheduled mission, handle change redirect, webhook replay idempotency.

### **12\. Decisions reconciled against the business plan**

* The `/@handle` room page is available to **every** host, not a Builder-tier reward. Tier rewards move to co-posting, custom brand, and rate.  
* Basic room standings are free. Adjusted boards and deep personal history stay in Athlete Pro.  
* Gym rooms are communities that extend beyond the facility; access follows room activity, not location.  
* Marketing copy: "room" replaces "squad" when referring to a coach's community.

---

## **Part B — How this compares to what exists**

Searched creator-fitness platforms, coach-led community apps, and synced-timer apps. Summary of what's already out there:

* **Playbook** is the incumbent for fitness creators: free to start on a 20% revenue share, it has paid creators more than $233M since 2016, and the product is an on-demand library, community feed, challenges, and live workouts streamed into the app. HubFit is similar for coaches, with challenges, leaderboards, badge sets, and share cards members post to Instagram.  
* **Ladder** is the closest "coach community" model: users are grouped into "teams" based on fitness level and goals, each a group assigned to a single coach, with a group chat where the coach answers questions, badges for weekly streaks, and "Cheers" between teammates. Training is asynchronous same-week programming, not a synced live event.  
* **Pulse** is the one to watch: it advertises "Sweat Sync Live" — jump into a friend's Round and stay in sync with live metrics, cheers, and leaderboard updates, and creators earn a share of subscription revenue whenever users complete their workouts. It is iPhone-only and built around video content, but it combines live sync with creator payouts.  
* **RunThatUp** does events with real-time leaderboards, group chat per event, and paid challenges, driven by HealthKit steps and distance rather than a workout clock.  
* **SmartWOD, PushPress's free timer, and the rest of the AMRAP-timer category** are solo tools — choose the WOD type, set the duration and go — with no multi-device sync or shared scoring.

**What is not original here:** a coach's persistent page with a workout library, weekly programming, leaderboards, share cards, streak recognition, and a revenue share to creators. Playbook, HubFit, and Ladder each have most of that.

**What is distinct, taken together:**

1. **The room's core event is a live, multi-device synced scoring session.** Everyone else's community layer sits on top of video or async logging. Pulse has live sync but between friends, not as a coach-hosted weekly room, and it requires a native app.  
2. **The money runs the opposite direction.** Playbook and HubFit take a cut of what the creator charges followers. Here the coach's followers pay the coach nothing; AWF pays the coach a share of *AWF's* subscription. That removes the creator's biggest launch problem (asking followers for money) and is why guest-first play is possible at all.  
3. **Guest-first participation with claim-later.** No comparable product lets someone finish a coach's live workout with no account and no app install and then attach to the coach afterwards. Every competitor gates on signup first.  
4. **Attribution through the event itself.** The referral record is created by joining the room and finishing, not by a link in a bio. That's a direct consequence of 1–3.

Honest read: the originality is the combination, not any single component, and Pulse shows the combination is thinkable by others. The defensible parts are the guest-first loop and the coach economics, because they depend on the platform, not the coach, owning the subscription. A patent question is one for an attorney; what this analysis supports is that there's a real positioning gap to occupy quickly.

---

## **Change log**

| \# | Section | Change | Why |
| ----- | ----- | ----- | ----- |
| 1 | 2 (new) | Added a vocabulary table and flagged that the coaches page says "squad" for what the plan calls "room." | The plan's own distinction (squad \= friends) contradicts the marketing copy already written. Fix before pilot hosts learn the wrong word. |
| 2 | 3 | Specified what co-hosts can't do and that revocation applies mid-mission. Added handle rules and 90-day redirects. | The plan said "up to three co-hosts" without boundaries; handle collisions and changes are a day-one support issue. |
| 3 | 4 | Merged "Save your result," "Join this room," and "Train with @handle" into one post-finish sheet with the room checkbox on by default; home coach set only if empty. | Three sequential prompts at the finish would tank claim rate. The records stay separate; the athlete sees one decision. |
| 4 | 4 | Decided the room page renders in the app, with an Astro OG shell. | The plan didn't say where `/@handle` lives; the project has both an Astro site and a Vite app, and building the page twice is the likely failure. |
| 5 | 5 | Fixed standings rules: same workout version \+ scoring rule \+ scaling tier; first attempt counts. | The plan asked for these to be defined; leaving them open produces inconsistent boards across screens. |
| 6 | 5 (new) | Added reminders (email 24h/1h \+ ICS). | The loop in §1 has no return trigger without one; a page nobody is nudged back to isn't a return loop. |
| 7 | 6 | Reactions become a fixed small set; member management is remove-only; earnings visible to owner only. | Scope control and to keep co-hosts away from financial data. |
| 8 | 7 | Entitlements modeled as rows with `source` and `expires_at`, never account flags. Referral **ledger** starts in phase 1 even though payouts are phase 4\. | The original sequence put all referral accounting last, which would lose founding hosts' first months of commissions. |
| 9 | 8 | Added a table sketch, explicit RLS rules, the `coach_users` grep, webhook idempotency, and timezone storage rules. | The plan stated principles; this is the checklist a Cursor session needs to not widen the platform coach role by accident. |
| 10 | 9 | Added: leaving a room doesn't clear home coach; read-only rooms reactivate; removal is immediate and unnotified; no ban/report in v1. | Lifecycle gaps that would otherwise be decided ad hoc in code. |
| 11 | 10 | Phase 1 renamed "Room boundary \+ ledger"; phase 2 gains reminders and room-branded share cards; validation gate stated as a concrete host action. | Follows from changes 6 and 8\. |
| 12 | 11 | Added host-side second-mission metric, reminder opt-in, and three release checks (DST, handle redirect, webhook replay). | The primary metric measures athletes; hosts stopping after one mission is the other way this dies. |
| 13 | 12 | Kept all three reconciliations and added the "room vs squad" copy change. | — |
| 14 | Part B (new) | Comparable-product assessment. | Requested. |

**Kept unchanged because they're right:** host pays, athlete plays free; membership ≠ attribution ≠ Pro; permissions in policies not navigation; no chat/DM/video; the new dashboard separate from `/coach`; the primary metric; gym access independent of location; no per-member billing; no paid room admission.

