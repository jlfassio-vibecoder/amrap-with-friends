import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';
import { AppHeader } from '@/components/AppHeader';
import { ActivityAttributionCard } from '@/components/hud/ActivityAttributionCard';
import { AttritionGrid } from '@/components/hud/AttritionGrid';
import { ClassificationBadge } from '@/components/hud/ClassificationBadge';
import { DailyTelemetry } from '@/components/hud/DailyTelemetry';
import { DomainMatrixChart } from '@/components/hud/DomainMatrixChart';
import {
  HudTopTabs,
  panelIdForHudTab,
  type HudTabDefinition,
  type HudTabKey,
} from '@/components/hud/HudTopTabs';
import { BenchmarkProgressPanel } from '@/components/mission/BenchmarkProgressPanel';
import { InAppActivitySummaryCard } from '@/components/hud/InAppActivitySummaryCard';
import { OutsideActivitySummaryCard } from '@/components/hud/OutsideActivitySummaryCard';
import { OvertrainingWarningCard } from '@/components/hud/OvertrainingWarningCard';
import { PhysicalActivityList } from '@/components/hud/PhysicalActivityList';
import { PhysicalActivityLogForm } from '@/components/hud/PhysicalActivityLogForm';
import { ScoreTrendChart } from '@/components/hud/ScoreTrendChart';
import { WeekDetailPanel } from '@/components/hud/WeekDetailPanel';
import { WeekPacingSpreadCard } from '@/components/hud/WeekPacingSpreadCard';
import { WeeklyBaselineBar } from '@/components/hud/WeeklyBaselineBar';
import { WeeklyVolumeTargetCard } from '@/components/hud/WeeklyVolumeTargetCard';
import { summarizePhysicalActivityWindow } from '@/lib/hud/activityWindowSummary';
import { evaluateOvertrainingRisk } from '@/lib/hud/evaluateOvertrainingRisk';
import { useBenchmarkProgress } from '@/hooks/useBenchmarkProgress';
import { hasAthleteBodyMetrics } from '@/lib/api/athleteProfile';
import { claimedVolumeTargetMinutes, quotasFromProfile } from '@/lib/hud/classificationQuotas';
import { scoreTrendFromHistory } from '@/lib/hud/scoreTrend';
import type { ClassificationRank } from '@/lib/hud/types';
import {
  hasInspectableHistory,
  isCurrentWeek,
  stepWeekIndex,
  summarizeWeekMinutesVsPrevious,
  weekAt,
} from '@/lib/hud/weekHistory';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useHudTelemetry } from '@/hooks/useHudTelemetry';
import { usePhysicalActivityLog } from '@/hooks/usePhysicalActivityLog';

const CLAIMED_RANK_LABEL: Partial<Record<ClassificationRank, string>> = {
  operator: 'OPERATOR',
  special_ops: 'SPECIAL OPS',
};

function opTempoSubtitle(
  rank: ClassificationRank | null,
  claimedMinutes: number,
  civilianMinutes: number
): string {
  const label = rank ? (CLAIMED_RANK_LABEL[rank] ?? rank.toUpperCase()) : 'CLAIMED';
  const overCivilian = claimedMinutes - civilianMinutes;
  const base = `Claimed ${label} · ${claimedMinutes} min`;
  if (overCivilian > 0) {
    return `${base} · +${overCivilian} over Civilian`;
  }
  return base;
}

const HUD_TABS: readonly HudTabDefinition[] = [
  { key: 'mission-health', label: 'Mission Health' },
  { key: 'week-history', label: 'Week History' },
  { key: 'domains', label: 'Domains' },
  { key: 'benchmarks', label: 'Benchmarks' },
  { key: 'physical-activity', label: 'Physical Activity' },
];

function HudPanel({
  tab,
  activeTab,
  children,
}: {
  tab: HudTabKey;
  activeTab: HudTabKey;
  children: ReactNode;
}) {
  const selected = tab === activeTab;

  return (
    <section
      id={panelIdForHudTab(tab)}
      role="tabpanel"
      aria-labelledby={`hud-tab-${tab}`}
      hidden={!selected}
      className={selected ? 'space-y-4' : undefined}
    >
      {selected ? children : null}
    </section>
  );
}

export default function HUDPage() {
  const { telemetry, error, loading, isAuthenticated, isAuthLoading } = useHudTelemetry();
  const { profile, loading: profileLoading } = useAthleteProfile();
  const quotas = quotasFromProfile(profile);
  const claimedTargetMinutes = claimedVolumeTargetMinutes(
    profile?.perceivedClassification ?? null,
    quotas
  );
  const showTelemetry = !loading && !profileLoading && isAuthenticated && telemetry;
  const metricsMissing =
    isAuthenticated && !profileLoading && profile !== null && !hasAthleteBodyMetrics(profile);

  const activityLog = usePhysicalActivityLog();
  const outsideSummary = summarizePhysicalActivityWindow(activityLog.entries);
  const overtrainingRisk = telemetry ? evaluateOvertrainingRisk(telemetry.overtraining) : null;
  const benchmarkProgress = useBenchmarkProgress(!isAuthLoading && isAuthenticated);
  // Read once per mount: a due date must not move because the HUD re-rendered.
  const [nowMs] = useState(() => Date.now());
  const showOvertrainingWarning =
    overtrainingRisk !== null && overtrainingRisk.riskLevel !== 'normal';

  // The one piece of the HUD that travels in time. Null means "nothing
  // inspected", which is a different state from "the current week" — the
  // live cards above never move either way.
  const historyWeeks = telemetry?.weeks ?? [];
  const [activeTab, setActiveTab] = useState<HudTabKey>('mission-health');
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const selectedWeek = weekAt(historyWeeks, selectedWeekIndex);
  const canInspectHistory = hasInspectableHistory(historyWeeks);
  const weekMinutesVsPrevious = summarizeWeekMinutesVsPrevious(historyWeeks);
  const previousHistoryWeek =
    historyWeeks.length >= 2 ? historyWeeks[historyWeeks.length - 2]! : null;
  const showTabs = !isAuthLoading && isAuthenticated;

  useEffect(() => {
    if (activeTab !== 'week-history') {
      setSelectedWeekIndex(null);
    }
  }, [activeTab]);

  function telemetryEmptyState(copy: string) {
    return <p className="text-sm text-secondary">{copy}</p>;
  }

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="HUD" subtitle="Operational telemetry" />

      <div className="mx-auto max-w-5xl space-y-8 px-6 pb-10 pt-6 lg:px-8 lg:py-10">
        <p className="text-sm text-secondary lg:hidden">
          Locked-mission volume and pacing for the current local week.
        </p>

        <div className="hidden space-y-2 lg:block">
          <h1 className="text-display text-5xl text-ink">HUD</h1>
          <p className="text-sm text-secondary">
            Locked-mission volume and pacing for the current local week.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link
            className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
            to="/create"
          >
            Plan mission
          </Link>
          <Link
            className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
            to="/squad"
          >
            Invite your squad →
          </Link>
          <Link
            className="border-b border-accent pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink hover:text-accent"
            to="/join"
          >
            Join a mission
          </Link>
        </div>

        {loading || profileLoading ? <p className="text-sm text-secondary">Loading…</p> : null}

        {!isAuthLoading && !isAuthenticated ? (
          <p className="text-sm text-secondary">
            Sign in to view your HUD. Only missions saved to your account with a locked score count.
          </p>
        ) : null}

        {error ? <p className="text-error">Error: {error}</p> : null}

        {metricsMissing ? (
          <p className="border-line rounded-card border bg-surface px-4 py-3 text-sm text-secondary">
            <Link className="link-accent font-semibold" to="/intake?next=%2Fhud">
              Add body metrics for load telemetry
            </Link>
          </p>
        ) : null}

        {showTelemetry ? (
          <div className="space-y-4">
            <ClassificationBadge
              classification={telemetry.classification}
              perceivedClassification={profile?.perceivedClassification ?? null}
              quotas={quotas}
              defaultExpanded
            />
          </div>
        ) : null}

        {showTabs ? (
          <div className="space-y-4">
            <HudTopTabs tabs={HUD_TABS} activeTab={activeTab} onChange={setActiveTab} />

            <HudPanel tab="mission-health" activeTab={activeTab}>
              {!showTelemetry ? (
                telemetryEmptyState(
                  'Mission health will appear here once your HUD telemetry loads.'
                )
              ) : (
                <>
                  {showOvertrainingWarning ? (
                    <OvertrainingWarningCard overtraining={telemetry.overtraining} />
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <InAppActivitySummaryCard activity7d={telemetry.activity7d} />
                    <OutsideActivitySummaryCard entries={activityLog.entries} />
                  </div>
                  {claimedTargetMinutes !== null ? (
                    <WeeklyVolumeTargetCard
                      title="OP TEMPO"
                      ariaLabel="Operational tempo"
                      subtitle={opTempoSubtitle(
                        profile?.perceivedClassification ?? null,
                        claimedTargetMinutes,
                        quotas.civilianMinutes
                      )}
                      weekMinutes={telemetry.weekMinutes}
                      weekEndsAt={telemetry.weekEndsAt}
                      targetMinutes={claimedTargetMinutes}
                      previousWeekMinutes={weekMinutesVsPrevious.previousMinutes}
                      previousWeek={previousHistoryWeek}
                      shareNoun="target"
                      paceHeading="Pace to target"
                      targetNoun="target"
                      progressAriaLabel="Weekly minutes toward claimed classification target"
                      testIdPrefix="op-tempo"
                    />
                  ) : null}
                  <WeeklyBaselineBar
                    weekMinutes={telemetry.weekMinutes}
                    weekEndsAt={telemetry.weekEndsAt}
                    baselineMinutes={quotas.civilianMinutes}
                    previousWeekMinutes={weekMinutesVsPrevious.previousMinutes}
                    previousWeek={previousHistoryWeek}
                  />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <DailyTelemetry lastLockedAt={telemetry.lastLockedAt} />
                    <WeekPacingSpreadCard
                      weekPviAverage={telemetry.weekPviAverage}
                      weekPviMissions={telemetry.weekPviMissions}
                    />
                  </div>
                  <ActivityAttributionCard
                    inAppMissions={telemetry.activity7d.missionCount}
                    outsideMissions={outsideSummary.missionCount}
                    inAppMinutes={telemetry.activity7d.minutes}
                    outsideMinutes={outsideSummary.totalMinutes}
                  />
                </>
              )}
            </HudPanel>

            <HudPanel tab="week-history" activeTab={activeTab}>
              {!showTelemetry ? (
                telemetryEmptyState('Week history will appear here once your HUD telemetry loads.')
              ) : historyWeeks.length === 0 ? (
                telemetryEmptyState('No locked week history yet.')
              ) : (
                <>
                  <ScoreTrendChart weeks={scoreTrendFromHistory(historyWeeks)} />
                  <AttritionGrid
                    attrition={telemetry.attrition}
                    weekEndsAt={telemetry.weekEndsAt}
                    weeks={historyWeeks}
                    selectedIndex={selectedWeekIndex}
                    onSelect={canInspectHistory ? setSelectedWeekIndex : undefined}
                  />
                  {selectedWeek !== null && selectedWeekIndex !== null ? (
                    <WeekDetailPanel
                      week={selectedWeek}
                      isCurrent={isCurrentWeek(historyWeeks, selectedWeekIndex)}
                      baselineMinutes={quotas.civilianMinutes}
                      canStepOlder={selectedWeekIndex > 0}
                      canStepNewer={selectedWeekIndex < historyWeeks.length - 1}
                      onStepOlder={() =>
                        setSelectedWeekIndex(stepWeekIndex(historyWeeks, selectedWeekIndex, -1))
                      }
                      onStepNewer={() =>
                        setSelectedWeekIndex(stepWeekIndex(historyWeeks, selectedWeekIndex, 1))
                      }
                      onJumpToCurrent={() => setSelectedWeekIndex(historyWeeks.length - 1)}
                      onClose={() => setSelectedWeekIndex(null)}
                    />
                  ) : null}
                </>
              )}
            </HudPanel>

            <HudPanel tab="domains" activeTab={activeTab}>
              {!showTelemetry ? (
                telemetryEmptyState(
                  'Domain balance will appear here once your HUD telemetry loads.'
                )
              ) : (
                <DomainMatrixChart domainMinutes30d={telemetry.domainMinutes30d} />
              )}
            </HudPanel>

            <HudPanel tab="benchmarks" activeTab={activeTab}>
              {benchmarkProgress.loading ? (
                telemetryEmptyState('Loading benchmarks…')
              ) : benchmarkProgress.benchmarks.length === 0 &&
                benchmarkProgress.campaignSlots.length === 0 ? (
                telemetryEmptyState('No active benchmarks yet.')
              ) : (
                <BenchmarkProgressPanel
                  benchmarks={benchmarkProgress.benchmarks}
                  missions={benchmarkProgress.missions}
                  campaignSlots={benchmarkProgress.campaignSlots}
                  riskLevel={overtrainingRisk?.riskLevel}
                  now={nowMs}
                />
              )}
            </HudPanel>

            <HudPanel tab="physical-activity" activeTab={activeTab}>
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-ink">Physical activity</h2>
                <p className="text-sm text-secondary">
                  Outside training you log here does not count toward weekly classification minutes
                  — verified rank stays locked-AMRAP-only.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <PhysicalActivityLogForm
                    submitting={activityLog.submitting}
                    onSubmit={activityLog.logEntry}
                  />
                  {activityLog.loading ? (
                    <p className="text-sm text-secondary">Loading activity…</p>
                  ) : (
                    <PhysicalActivityList
                      entries={activityLog.entries}
                      onDelete={(id) => {
                        void activityLog.removeEntry(id);
                      }}
                    />
                  )}
                  {activityLog.error ? (
                    <p className="text-error text-sm">{activityLog.error}</p>
                  ) : null}
                </div>
              </section>
            </HudPanel>
          </div>
        ) : null}

        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          {isAuthenticated ? (
            <Link className="link-accent" to="/intake?next=%2Fhud">
              Edit profile / HUD metrics
            </Link>
          ) : null}
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </p>
      </div>
    </main>
  );
}
