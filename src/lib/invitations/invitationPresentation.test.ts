import { describe, expect, it } from 'vitest';
import {
  campaignJoinCtaLabel,
  campaignViewCtaLabel,
  formatInvitationWhen,
  invitationAudienceSummary,
  invitationHeadline,
  missionInvitationAction,
  missionInvitationCtaLabel,
  sendInvitationTypeLabel,
  workoutInvitationCtaLabel,
} from './invitationPresentation';

describe('invitationHeadline', () => {
  it('names a mission share', () => {
    expect(
      invitationHeadline({
        senderName: 'Justin',
        type: 'mission',
        durationMinutes: 15,
        campaignWeekCount: null,
        includeSquadInvite: false,
      })
    ).toBe('Justin shared a 15-minute mission');
  });

  it('names a squad bundle with a workout', () => {
    expect(
      invitationHeadline({
        senderName: 'Justin',
        type: 'workout',
        durationMinutes: 15,
        campaignWeekCount: null,
        includeSquadInvite: true,
      })
    ).toBe('Justin invited you to their squad and sent you a 15-minute workout');
  });
});

describe('missionInvitationAction', () => {
  it('uses Join while waiting with no future schedule', () => {
    expect(
      missionInvitationAction({
        state: 'waiting',
        scheduledAt: null,
        alreadyJoined: false,
      })
    ).toBe('join_mission');
  });

  it('uses View when the rally is still in the future', () => {
    expect(
      missionInvitationAction({
        state: 'waiting',
        scheduledAt: '2026-09-12T18:00:00.000Z',
        alreadyJoined: false,
        nowMs: Date.parse('2026-09-11T12:00:00.000Z'),
      })
    ).toBe('view_mission');
  });

  it('returns to a mission the viewer already joined', () => {
    expect(
      missionInvitationAction({
        state: 'work',
        scheduledAt: null,
        alreadyJoined: true,
      })
    ).toBe('return_mission');
  });

  it('does not promise Join once live joining is closed', () => {
    expect(
      missionInvitationAction({
        state: 'work',
        scheduledAt: null,
        alreadyJoined: false,
      })
    ).toBe('unavailable');
  });

  it('treats a full waiting mission as unavailable', () => {
    expect(
      missionInvitationAction({
        state: 'waiting',
        scheduledAt: null,
        alreadyJoined: false,
        joinable: false,
      })
    ).toBe('unavailable');
  });

  it('switches a finished invite to View workout', () => {
    expect(
      missionInvitationAction({
        state: 'finished',
        scheduledAt: null,
        alreadyJoined: false,
      })
    ).toBe('view_workout');
    expect(missionInvitationCtaLabel('view_workout', 15)).toBe('View workout');
  });
});

describe('cta labels', () => {
  it('keeps duration in the primary actions', () => {
    expect(missionInvitationCtaLabel('join_mission', 15)).toBe('Join 15-min mission');
    expect(workoutInvitationCtaLabel(10)).toBe('Start 10-min mission');
    expect(campaignViewCtaLabel(8)).toBe('View 8-week campaign');
    expect(campaignJoinCtaLabel(8)).toBe('Join 8-week campaign');
  });

  it('names send-flow type radios with duration when known', () => {
    expect(sendInvitationTypeLabel('mission', 15, null)).toBe('Invite to this 15-min mission');
    expect(sendInvitationTypeLabel('workout', 10, null)).toBe('Send this 10-min workout');
    expect(sendInvitationTypeLabel('campaign', 15, 8)).toBe('Invite to this 8-week campaign');
    expect(sendInvitationTypeLabel('campaign', 15, null)).toBe('Invite to a campaign');
  });
});

describe('invitationAudienceSummary', () => {
  it('names both groups and a chat post', () => {
    expect(invitationAudienceSummary({ squadCount: 1, missionCount: 2, postInChat: true })).toBe(
      'Sending to 3 people (1 squad friend, 2 people in this mission). Will also post in chat.'
    );
  });

  it('asks for a recipient when nothing is selected', () => {
    expect(invitationAudienceSummary({ squadCount: 0, missionCount: 0, postInChat: false })).toBe(
      'Pick at least one recipient.'
    );
  });
});

describe('formatInvitationWhen', () => {
  it('returns null for missing or invalid timestamps', () => {
    expect(formatInvitationWhen(null)).toBeNull();
    expect(formatInvitationWhen('not-a-date')).toBeNull();
  });
});
