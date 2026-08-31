import { describe, expect, it } from 'vitest';
import {
  canDeleteCampaign,
  canEditCampaign,
  canEndCampaign,
  canRescheduleOccurrence,
  hasCampaignStarted,
  type CampaignLifecycleInput,
} from './campaignLifecycle';

function planned(count: number) {
  return Array.from({ length: count }, () => ({ status: 'planned', sessionId: null }));
}

function input(overrides: Partial<CampaignLifecycleInput> = {}): CampaignLifecycleInput {
  return {
    viewerRole: 'host',
    status: 'active',
    occurrences: planned(4),
    activeMemberCount: 1,
    ...overrides,
  };
}

describe('hasCampaignStarted', () => {
  it('is false while every session is still planned', () => {
    expect(hasCampaignStarted(planned(4))).toBe(false);
  });

  it('is true once a session has been generated', () => {
    expect(hasCampaignStarted([...planned(3), { status: 'generated', sessionId: 'sess-1' }])).toBe(
      true
    );
  });

  it('is true for a done or skipped session', () => {
    expect(hasCampaignStarted([{ status: 'done', sessionId: 'sess-1' }])).toBe(true);
    expect(hasCampaignStarted([{ status: 'skipped', sessionId: null }])).toBe(true);
  });

  it('is true for a session id on a still-planned row', () => {
    // Belt and braces: the generator stamps both, so one without the other is
    // a state we should refuse to delete through rather than reason about.
    expect(hasCampaignStarted([{ status: 'planned', sessionId: 'sess-1' }])).toBe(true);
  });

  it('is false for a campaign with no sessions at all', () => {
    expect(hasCampaignStarted([])).toBe(false);
  });
});

describe('canEndCampaign', () => {
  it('lets the host end a live campaign', () => {
    expect(canEndCampaign(input())).toBe(true);
  });

  it('lets the host end one that is already under way', () => {
    expect(canEndCampaign(input({ occurrences: [{ status: 'done', sessionId: 'sess-1' }] }))).toBe(
      true
    );
  });

  it('lets the host end one other people have joined', () => {
    expect(canEndCampaign(input({ activeMemberCount: 5 }))).toBe(true);
  });

  it('offers nothing to a member', () => {
    expect(canEndCampaign(input({ viewerRole: 'member' }))).toBe(false);
  });

  it('offers nothing on a campaign that is already over', () => {
    expect(canEndCampaign(input({ status: 'complete' }))).toBe(false);
    expect(canEndCampaign(input({ status: 'abandoned' }))).toBe(false);
  });
});

describe('canDeleteCampaign', () => {
  it('lets the host delete one that has not run and nobody joined', () => {
    expect(canDeleteCampaign(input())).toBe(true);
  });

  it('refuses once a session has been generated', () => {
    expect(
      canDeleteCampaign(
        input({ occurrences: [...planned(3), { status: 'generated', sessionId: 'sess-1' }] })
      )
    ).toBe(false);
  });

  it('refuses once anyone else has joined', () => {
    expect(canDeleteCampaign(input({ activeMemberCount: 2 }))).toBe(false);
  });

  it('offers nothing to a member', () => {
    expect(canDeleteCampaign(input({ viewerRole: 'member' }))).toBe(false);
  });

  it('offers nothing on a campaign that is already over', () => {
    expect(canDeleteCampaign(input({ status: 'abandoned' }))).toBe(false);
  });

  it('is the narrower of the two, so ending is always available where deleting is', () => {
    const fresh = input();
    expect(canDeleteCampaign(fresh) && canEndCampaign(fresh)).toBe(true);
  });
});

describe('canEditCampaign', () => {
  it('lets the host rename a live campaign, however far along it is', () => {
    expect(canEditCampaign(input())).toBe(true);
    expect(canEditCampaign(input({ occurrences: [{ status: 'done', sessionId: 's1' }] }))).toBe(
      true
    );
  });

  it('offers nothing to a member', () => {
    expect(canEditCampaign(input({ viewerRole: 'member' }))).toBe(false);
  });

  it('offers nothing once the campaign is over', () => {
    expect(canEditCampaign(input({ status: 'complete' }))).toBe(false);
    expect(canEditCampaign(input({ status: 'abandoned' }))).toBe(false);
  });
});

describe('canRescheduleOccurrence', () => {
  const planned_ = { status: 'planned', sessionId: null };

  it('moves a session that is still only a plan', () => {
    expect(canRescheduleOccurrence(input(), planned_)).toBe(true);
  });

  it('refuses one whose rally point is already open', () => {
    expect(canRescheduleOccurrence(input(), { status: 'generated', sessionId: 's1' })).toBe(false);
  });

  it('refuses one that has been run or missed', () => {
    expect(canRescheduleOccurrence(input(), { status: 'done', sessionId: 's1' })).toBe(false);
    expect(canRescheduleOccurrence(input(), { status: 'skipped', sessionId: null })).toBe(false);
  });

  it('refuses a planned row that somehow already has a session', () => {
    expect(canRescheduleOccurrence(input(), { status: 'planned', sessionId: 's1' })).toBe(false);
  });

  it('offers nothing to a member, or on a closed campaign', () => {
    expect(canRescheduleOccurrence(input({ viewerRole: 'member' }), planned_)).toBe(false);
    expect(canRescheduleOccurrence(input({ status: 'abandoned' }), planned_)).toBe(false);
  });
});
