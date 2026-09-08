import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
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

export default function PlanMissionPage() {
  const navigate = useNavigate();
  const { profile } = useAthleteProfile();
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <section className="space-y-4" aria-labelledby="ready-chains-heading">
        <div>
          <h2 id="ready-chains-heading" className="text-lg font-semibold text-ink">
            Ready-made mission chains
          </h2>
          <p className="text-sm text-secondary">
            Pre-built multi-workout packs, grouped by time domain. Launch opens the first mission
            and queues the rest.
          </p>
        </div>
        {groupPresetsByCategory(CHAIN_MISSION_PRESETS).map(({ label, presets }) => (
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
        ))}
      </section>

      <section className="space-y-4" aria-labelledby="ready-campaigns-heading">
        <div>
          <h2 id="ready-campaigns-heading" className="text-lg font-semibold text-ink">
            Ready-made campaigns
          </h2>
          <p className="text-sm text-secondary">
            Start a full schedule from a curated shape, grouped by time domain. You can rename and
            invite after it lands.
          </p>
        </div>
        {groupPresetsByCategory(CAMPAIGN_MISSION_PRESETS).map(({ label, presets }) => (
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
        ))}
      </section>
    </NarrowPageLayout>
  );
}
