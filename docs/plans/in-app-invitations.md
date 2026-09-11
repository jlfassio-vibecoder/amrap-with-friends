# In-app invitations — proposed feature plan

_Draft — September 11, 2026. Proposed behavior; not a statement of shipped functionality._

## 1. One entry point across the app

Add a **Send invitation** action to:

- The mission waiting screen.
- Live mission controls, without covering the timer or logging controls.
- The finish screen and mission history.
- Campaign details.
- Squad friend actions.

Add **Share a workout or invitation** beside the chat composer. Hosts and participants can use the same flow, subject to the destination’s access rules.

The sender chooses what to send, who receives it, and an optional short note.

## 2. Three invitation types

### Invite to this mission

References the existing mission. The card shows its workout, duration, scheduled time, and current availability.

The button reflects its state:

- Scheduled: **View 15-min mission**
- Open: **Join 15-min mission**
- Already joined: **Return to 15-min mission**
- Finished: **View workout**

A live invitation respects existing late-join rules. It must not restart the clock or promise entry when joining is closed.

### Send this workout

Sends a saved workout copy that the recipient can run independently. This extends the existing workout-sharing behavior.

Use **Start 15-min mission** as the action. Starting creates a new mission with its own participants and results.

This should be the default after a mission finishes. Preserve the original workout version, duration, and scaling information needed to understand it; exclude the sender’s private notes and results.

### Invite to a campaign

Shows the campaign’s name, length, start date, frequency, and host.

Use **View 8-week campaign**, followed by an explicit **Join 8-week campaign** action.

Sending should not enroll the recipient automatically. I recommend replacing the current direct-add interaction with this invitation flow. Joining must recheck availability, capacity, and permissions.

## 3. Recipient selection

Offer two recipient groups:

- **Your squad:** select one or more friends.
- **People in this mission:** select participants or explicitly choose everyone currently in the mission.

Show the audience and recipient count before sending.

Keep **Post in mission chat** separate from private delivery. Sending something privately to a Squad friend should not publish their name or note to the whole mission.

For “Share with everyone in this mission,” create one chat card and individual inbox deliveries for eligible signed-in recipients present at send time. Later arrivals can see the card and choose **Save to Sent to you**, rather than receiving old invitations automatically.

Guests can use accessible invitation buttons in chat. Saving across devices or joining a Squad requires sign-in, with the invitation preserved through that step.

## 4. Add someone to your Squad while sending

A participant’s action menu should offer:

- **Invite to squad**
- **Send workout**
- **Send campaign invitation**, when authorized

For someone who is not yet a friend, allow **Invite to squad and send**.

The recipient sees one card explaining both actions:

> Justin invited you to his squad and sent you a 15-minute workout.

Provide separate choices to **Accept squad invite** and **View workout**. Accepting friendship should not automatically join a mission or campaign, and opening a workout should not accept friendship.

Allow this contextual request between verified participants in the same mission. Other private sends remain limited to Squad friends. Existing decline restrictions must continue to apply.

Keep pending friendship requests synchronized with the Squad page so accepting in either place resolves the same request.

## 5. Invitation cards in chat

Render a structured card rather than displaying a raw URL:

> **Justin shared a 15-minute mission**
> Saturday · 9:00 AM in your timezone
> “Join me for this one.”
> **[Join 15-min mission]**

Use the same card presentation in chat and “Sent to you.”

Store the invitation’s identity and target, then resolve the appropriate button from current availability. A mission that has finished must not retain a misleading “Join” button.

When someone pastes a recognized AWF invitation link, offer **Send as invitation** with a preview and audience selection. Ordinary pasted links should not silently generate inbox deliveries.

## 6. Expand “Sent to you” into the invitation inbox

Keep the existing tab at `/my-missions`. Include:

- Mission invitations.
- Workouts to do later.
- Campaign invitations.
- Squad requests carrying an attached workout or campaign.

Each item shows sender, note, duration or campaign length, current availability, and its primary action.

Add an unread count and distinguish unread status from action status. Reading a card does not accept it.

Use **Dismiss** for removing an item from the active list. The current “Not now” label is misleading because it dismisses the workout rather than postponing it.

After joining or starting, the actual mission or campaign appears in its normal tab. Keep the invitation in a small resolved history so it remains understandable where it came from.

## 7. Implementation approach

Create a shared invitation record with separate recipient delivery records.

The invitation describes:

- Sender.
- Type and target.
- Optional source mission and chat message.
- Optional note.
- Saved workout version when applicable.

Each delivery tracks:

- Recipient.
- Read timestamp.
- Pending, accepted, dismissed, or unavailable state.
- Resulting mission or campaign membership when acted upon.

Link chat messages to invitations using a typed attachment. Keep existing text messages compatible.

Reuse existing assigned workouts as the workout payload and execution path, while presenting them through the unified inbox. Preserve all pending items during migration and avoid showing them twice.

Use server-side operations to validate the sender, recipients, target access, and any friendship request. Creating the chat card and its deliveries should be one consistent operation, with safe retries that cannot duplicate sends.

Starting a shared workout also needs retry protection. Today, creating the mission and marking the workout started are separate calls; the new flow should recover the same created mission if the second step fails.

Refresh inbox counts while the app is open and on return to the tab. Keep live-workout notifications quiet and nonblocking.

## 8. Access and delivery rules

- Participation in a source mission does not grant permission to invite people into every other mission or campaign.
- Campaign participant sharing needs an explicit host-controlled policy; the current invite-code access is host-oriented.
- Invitations never expose host tokens, guest claim tokens, or private participant data.
- Revoked or closed targets show an unavailable state.
- Repeated clicks and reconnects do not generate duplicate deliveries.
- Keep per-sender limits and pending-invitation caps.
- A recipient can dismiss or block future invitations without affecting their workout.
- Guest-to-account delivery must use verified claiming, never nickname matching.
- Finished mission history can retain sharing actions without making old chat an unrestricted messaging channel.

## 9. Build sequence

1. **Unified inbox foundation:** invitation records, delivery states, permissions, and compatibility with existing sent workouts.
2. **Reusable send flow:** Squad selection, workout sharing, and invitations to existing missions.
3. **Chat cards:** structured attachments, explicit group delivery, and recognized-link previews.
4. **Squad request bundles and campaigns:** independent acceptance, participant sharing policy, and removal of automatic enrollment from the invitation flow.
5. **Verification:** guest sign-in recovery, duplicate retries, changing mission states, blocked requests, closed campaigns, and mobile behavior during a workout.

## Acceptance example

After finishing a mission, Alex selects two participants and a Squad friend, sends the workout with “Same time tomorrow?”, and explicitly posts it in chat.

The selected signed-in recipients receive it in **Sent to you**. The chat displays a workout card with a button. A participant who is not Alex’s friend can independently accept a Squad request. Starting the shared workout creates a new mission without changing the completed one.
