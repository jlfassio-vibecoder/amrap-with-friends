# Daisy-chaining missions (persistent Staging Area)

Ad-hoc Create/Join rooms can outlive a single workout. The shared room is a
**lobby**; each workout remains a **session**.

## Model

| Entity | Role |
| --- | --- |
| `lobbies` | Persistent Staging Area: `host_user_id`, `active_session_id`, `status` |
| `lobby_members` | Crew in the room (claimed users keep their seat across sessions) |
| `sessions.lobby_id` | Links a workout instance to its room |

Host **command** lives on `lobbies.host_user_id`. Each session still mints its
own `host_token`. Pass Command and stale-host claim rotate the waiting
session’s token in the same transaction.

## Client flow

1. Create session → `create_lobby_session` → `/session/:id` (lobby id stored)
2. Rally link → `/join?l={lobbyId}`
3. After results → **Back to staging** → `/lobby/:lobbyId`
4. Host picks next workout → `start_next_lobby_session` → crew force-nav into the new session
5. **Pass Command** hands host to another claimed crewmate
6. AFK host (45s grace) → `claim_lobby_command_if_stale`

## Out of scope (this epic)

Campaign live sessions, featured WODs, makeups, guest-as-host, mid-workout host failover.
