# Daisy-chaining missions (persistent Staging Area)

Ad-hoc Create/Join rooms can outlive a single workout. The shared room is a
**lobby**; each workout remains a **session**.

## Model

| Entity              | Role                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `lobbies`           | Persistent Staging Area: `host_user_id`, `active_session_id`, `status` |
| `lobby_members`     | Crew in the room (claimed users keep their seat across sessions)       |
| `sessions.lobby_id` | Links a workout instance to its room                                   |

Host **command** lives on `lobbies.host_user_id`. Each session still mints its
own `host_token`. Pass Command and stale-host claim rotate the waiting
session’s token in the same transaction.

Seat ceiling is **100** for both lobby members and session participants (aligned;
the earlier epic note of 6 was superseded by the soft abuse/cost raise).

## Client flow

1. Create session → `create_lobby_session` → `/session/:id` (lobby id stored)
2. Rally link → `/join?l={lobbyId}`
3. After results → **Back to staging** → `/lobby/:lobbyId`
4. Host picks next workout → `start_next_lobby_session` → crew soft force-nav (5s banner, Join now) into the new session
5. **Pass Command** hands host to another claimed crewmate
6. AFK host (45s grace) → `claim_lobby_command_if_stale`

## Analytics

| Event                   | Fired from                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| `lobby_created`         | `createLobbySession`                                                           |
| `lobby_joined`          | `joinLobby`                                                                    |
| `command_passed`        | `passLobbyCommand`                                                             |
| `lobby_next_session`    | `startNextLobbySession`                                                        |
| `lobby_closed`          | `closeLobby`; `leaveLobby` when last host leaves                               |
| `lobby_host_reassigned` | `claimLobbyCommandIfStale` on claim; `leaveLobby` when host leaves a successor |

## Risk mitigations (status)

| Risk                            | Status                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Dual authority drift            | Done — Pass / claim / start_next update lobby host + waiting token in one RPC                  |
| Stale host_token after Pass     | Done — clear stored token; UI clears on `host_user_id` mismatch                                |
| Guest reclaim across sessions   | Done — guests rejoin by nickname; staging copy for guests only                                 |
| Force-nav while typing partials | Done — gated while partials open; soft banner + 5s then auto-nav                               |
| Realtime miss                   | Done — lobby visibility/focus refetch; force-nav on active session change                      |
| Host cap (3 active)             | Done — close/leave auto-close finishes waiting/setup orphans; closed lobbies excluded from cap |
| RLS / Realtime leak             | Done — no `host_token` in SELECT grants                                                        |
| Squad vocabulary bleed          | Done — staging uses crew / Staging area / Rally link                                           |

## Out of scope (this epic)

- Campaign occurrence sessions
- Featured WOD
- Makeup pacers
- Guest-as-host
- Mid-workout host failover
- Empty-lobby / idle TTL `pg_cron` (manual close + last-host leave already close the room)
