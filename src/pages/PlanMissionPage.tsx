import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import {
  FITNESS_SEARCH_TOPS,
  presetMatchesGoalFilter,
  subsForTop,
  type FitnessSearchGoalFilter,
  type FitnessSearchTopFilter,
} from '@/data/fitnessSearchGoals';
import {
  CAMPAIGN_MISSION_PRESETS,
  CHAIN_MISSION_PRESETS,
  groupPresetsByCategory,
  resolveChainPresetTemplates,
  type CampaignMissionPreset,
  type ChainMissionPreset,
} from '@/data/planMissionPresets';
import { createCampaign } from '@/lib/api/campaigns';
import { setMissionChain as persistMissionChain } from '@/lib/api/missionChain';
import { fetchHostActiveMissionCount } from '@/lib/api/missions';
import { createRallyPointMission } from '@/lib/api/rallyPoint';
import { track } from '@/lib/analytics/track';
import {
  buildCampaignCalendar,
  calendarDateToday,
  CampaignValidationError,
  defaultCampaignStartDate,
  formatCampaignShape,
  planCampaignWorkouts,
  suggestedSlots,
} from '@/lib/campaign';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { appendTemplatesToChainDraft } from '@/lib/mission/chainDraft';
import { HOST_ACTIVE_MISSION_LIMIT } from '@/lib/mission/rallySchedule';
import { domainForCap } from '@/lib/timeDomains';

type ReadyMadeTab = 'chains' | 'campaigns';

type GoalFilterState = {
  top: FitnessSearchTopFilter;
  sub: FitnessSearchGoalFilter;
};

function readyMadeTabClass(selected: boolean): string {
  return selected
    ? 'flex-1 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-on-accent'
    : 'flex-1 rounded-full px-3 py-2 text-sm font-semibold text-secondary hover:text-ink';
}

function filterChipClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent'
    : 'rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-secondary hover:text-ink';
}

function GoalFocusFilters({
  top,
  sub,
  onTopChange,
  onSubChange,
}: {
  top: FitnessSearchTopFilter;
  sub: FitnessSearchGoalFilter;
  onTopChange: (value: FitnessSearchTopFilter) => void;
  onSubChange: (value: FitnessSearchGoalFilter) => void;
}) {
  const focusOptions = top === 'all' ? [] : subsForTop(top);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Goal</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fitness goal">
          <button
            type="button"
            role="tab"
            aria-selected={top === 'all'}
            className={filterChipClass(top === 'all')}
            onClick={() => onTopChange('all')}
          >
            All
          </button>
          {FITNESS_SEARCH_TOPS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={top === entry.id}
              className={filterChipClass(top === entry.id)}
              onClick={() => onTopChange(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      {focusOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Focus</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fitness focus">
            <button
              type="button"
              role="tab"
              aria-selected={sub === 'all'}
              className={filterChipClass(sub === 'all')}
              onClick={() => onSubChange('all')}
            >
              All
            </button>
            {focusOptions.map((goal) => (
              <button
                key={goal.id}
                type="button"
                role="tab"
                aria-selected={sub === goal.id}
                className={filterChipClass(sub === goal.id)}
                onClick={() => onSubChange(goal.id)}
              >
                {goal.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PlanMissionPage() {
  const navigate = useNavigate();
  const { profile } = useAthleteProfile();
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyMadeTab, setReadyMadeTab] = useState<ReadyMadeTab>('chains');
  const [chainGoalFilter, setChainGoalFilter] = useState<GoalFilterState>({
    top: 'all',
    sub: 'all',
  });
  const [campaignGoalFilter, setCampaignGoalFilter] = useState<GoalFilterState>({
    top: 'all',
    sub: 'all',
  });

  useEffect(() => {
    let cancelled = false;
    void fetchHostActiveMissionCount().then((result) => {
      if (cancelled || result.data === null) {
        return;
      }
      setActiveCount(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const capReached = (activeCount ?? 0) >= HOST_ACTIVE_MISSION_LIMIT;
  const nickname = profile?.nickname?.trim() ?? '';

  const activeGoalFilter = readyMadeTab === 'chains' ? chainGoalFilter : campaignGoalFilter;

  function setActiveTop(top: FitnessSearchTopFilter) {
    const next = { top, sub: 'all' as const };
    if (readyMadeTab === 'chains') {
      setChainGoalFilter(next);
    } else {
      setCampaignGoalFilter(next);
    }
  }

  function setActiveSub(sub: FitnessSearchGoalFilter) {
    if (readyMadeTab === 'chains') {
      setChainGoalFilter((current) => ({ ...current, sub }));
    } else {
      setCampaignGoalFilter((current) => ({ ...current, sub }));
    }
  }

  const visibleChains = CHAIN_MISSION_PRESETS.filter((preset) =>
    presetMatchesGoalFilter(preset.searchGoals, chainGoalFilter.top, chainGoalFilter.sub)
  );
  const visibleCampaigns = CAMPAIGN_MISSION_PRESETS.filter((preset) =>
    presetMatchesGoalFilter(preset.searchGoals, campaignGoalFilter.top, campaignGoalFilter.sub)
  );

  async function launchChain(preset: ChainMissionPreset) {
    setError(null);
    if (capReached) {
      setError(`You already have ${HOST_ACTIVE_MISSION_LIMIT} active missions.`);
      return;
    }
    if (!nickname) {
      setError('Add your name in Your profile before launching.');
      return;
    }

    setBusyId(preset.id);
    try {
      const templates = resolveChainPresetTemplates(preset);
      const first = templates[0];
      if (!first) {
        setError('This chain preset is empty.');
        return;
      }
      const pageClock = first.durationMinutes;
      const domain = domainForCap(pageClock) ?? 5;
      const chain = appendTemplatesToChainDraft([], templates, pageClock, domain);
      const head = chain[0];
      if (!head) {
        setError('Could not build this chain.');
        return;
      }

      const result = await createRallyPointMission({
        nickname,
        durationMinutes: head.durationMinutes,
        workout: head.workout,
        templateId: head.templateId,
        intensityTier: head.intensityTier,
      });

      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      const created = result.data;
      let chainSaveError: string | null = null;
      if (chain.length >= 2) {
        const chainResult = await persistMissionChain({
          rallyPointId: created.rallyPointId,
          items: chain.map((item, index) => ({
            durationMinutes: item.durationMinutes,
            workout: item.workout,
            templateId: item.templateId,
            intensityTier: item.intensityTier,
            startedMissionId: index === 0 ? created.missionId : null,
          })),
        });
        if (chainResult.error) {
          chainSaveError = chainResult.error.message;
        }
      }

      track('plan_hub_chain_launched', {
        preset_id: preset.id,
        chain_length: chain.length,
      });

      const missionPath = `/mission/${created.missionId}`;
      if (chainSaveError) {
        navigate(missionPath, { state: { chainSaveError } });
      } else {
        navigate(missionPath);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function startCampaign(preset: CampaignMissionPreset) {
    setError(null);
    setBusyId(preset.id);
    try {
      const startDate = defaultCampaignStartDate(calendarDateToday());
      const slots = suggestedSlots(preset.missionsPerWeek);
      const calendar = buildCampaignCalendar({
        weekCount: preset.weekCount,
        startDate,
        slots,
      });
      const occurrences = planCampaignWorkouts({
        occurrences: calendar.occurrences,
        tracks: preset.tracks,
      });

      const result = await createCampaign({
        name: preset.name,
        goal: preset.goal,
        weekCount: preset.weekCount,
        startDate,
        occurrences,
      });

      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      track('plan_hub_campaign_started', {
        preset_id: preset.id,
        week_count: preset.weekCount,
      });
      navigate(`/campaign/${result.data.campaignId}`);
    } catch (cause) {
      if (cause instanceof CampaignValidationError) {
        setError(cause.message);
      } else {
        setError(
          cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <NarrowPageLayout
      title="Plan"
      subtitle="Mission or campaign"
      contentMaxWidthClassName="max-w-3xl"
      desktopTitleAsPageHeading
    >
      <p className="text-sm text-secondary">
        Choose a single mission or a multi-week campaign. Ready-made packs launch in one click; full
        builders stay one step away when you want to customize.
      </p>

      {error ? (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2" aria-label="How to plan">
        <div className="card space-y-3 p-5">
          <h2 className="text-lg font-semibold text-ink">Mission</h2>
          <p className="text-sm text-secondary">
            Pick a workout or chain a few, then go live or schedule a rally point. Best when you
            want one session with friends today.
          </p>
          <AppLink className="btn-primary inline-flex" to="/create">
            Plan mission
          </AppLink>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="text-lg font-semibold text-ink">Campaign</h2>
          <p className="text-sm text-secondary">
            A 2–12 week programme with a benchmark and retests. Best when you want progress across
            weeks, not just one clock.
          </p>
          <Link className="btn-primary inline-flex" to="/campaign/new">
            New campaign
          </Link>
        </div>
      </section>

      <div
        className="inline-flex w-full rounded-full border border-border bg-page p-1"
        role="tablist"
        aria-label="Ready-made packs"
      >
        <button
          type="button"
          role="tab"
          id="ready-made-tab-chains"
          aria-controls="ready-made-panel-chains"
          aria-selected={readyMadeTab === 'chains'}
          className={readyMadeTabClass(readyMadeTab === 'chains')}
          onClick={() => setReadyMadeTab('chains')}
        >
          Mission chains
        </button>
        <button
          type="button"
          role="tab"
          id="ready-made-tab-campaigns"
          aria-controls="ready-made-panel-campaigns"
          aria-selected={readyMadeTab === 'campaigns'}
          className={readyMadeTabClass(readyMadeTab === 'campaigns')}
          onClick={() => setReadyMadeTab('campaigns')}
        >
          Campaigns
        </button>
      </div>

      {readyMadeTab === 'chains' ? (
        <section
          id="ready-made-panel-chains"
          role="tabpanel"
          aria-labelledby="ready-made-tab-chains"
          className="space-y-4"
        >
          <div>
            <h2 className="text-lg font-semibold text-ink">Ready-made mission chains</h2>
            <p className="text-sm text-secondary">
              Pre-built multi-workout packs, grouped by time domain. Launch opens the first mission
              and queues the rest.
            </p>
          </div>
          <GoalFocusFilters
            top={activeGoalFilter.top}
            sub={activeGoalFilter.sub}
            onTopChange={setActiveTop}
            onSubChange={setActiveSub}
          />
          {visibleChains.length === 0 ? (
            <p className="text-sm text-secondary">No ready-made packs for this goal yet.</p>
          ) : (
            groupPresetsByCategory(visibleChains).map(({ label, presets }) => (
              <div key={label.key} className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {label.brandName}
                  </p>
                  <p className="text-sm text-secondary">{label.tagline}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {presets.map((preset) => {
                    const templates = resolveChainPresetTemplates(preset);
                    const busy = busyId === preset.id;
                    return (
                      <li key={preset.id} className="card flex flex-col gap-3 p-5">
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold text-ink">{preset.name}</p>
                          <p className="text-sm text-secondary">{preset.blurb}</p>
                          <p className="text-xs text-muted">
                            {templates.map((template) => template.name).join(' → ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-primary w-full"
                          disabled={busy || busyId !== null || capReached}
                          onClick={() => void launchChain(preset)}
                        >
                          {busy ? 'Launching…' : 'Launch'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : (
        <section
          id="ready-made-panel-campaigns"
          role="tabpanel"
          aria-labelledby="ready-made-tab-campaigns"
          className="space-y-4"
        >
          <div>
            <h2 className="text-lg font-semibold text-ink">Ready-made campaigns</h2>
            <p className="text-sm text-secondary">
              Start a full schedule from a curated shape, grouped by time domain. You can rename and
              invite after it lands.
            </p>
          </div>
          <GoalFocusFilters
            top={activeGoalFilter.top}
            sub={activeGoalFilter.sub}
            onTopChange={setActiveTop}
            onSubChange={setActiveSub}
          />
          {visibleCampaigns.length === 0 ? (
            <p className="text-sm text-secondary">No ready-made packs for this goal yet.</p>
          ) : (
            groupPresetsByCategory(visibleCampaigns).map(({ label, presets }) => (
              <div key={label.key} className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {label.brandName}
                  </p>
                  <p className="text-sm text-secondary">{label.tagline}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {presets.map((preset) => {
                    const busy = busyId === preset.id;
                    const shape = formatCampaignShape(preset.weekCount, preset.missionsPerWeek);
                    return (
                      <li key={preset.id} className="card flex flex-col gap-3 p-5">
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold text-ink">{preset.name}</p>
                          <p className="text-sm text-secondary">{preset.goal}</p>
                          <p className="text-xs text-muted">{shape}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-primary w-full"
                          disabled={busy || busyId !== null}
                          onClick={() => void startCampaign(preset)}
                        >
                          {busy ? 'Starting…' : 'Start'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </NarrowPageLayout>
  );
}
