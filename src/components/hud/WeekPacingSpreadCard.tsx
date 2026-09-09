import { AppLink } from '@/components/AppLink';
import { HudInfoDisclosure } from '@/components/hud/HudInfoDisclosure';
import {
  describeWeeklyPviGuidance,
  formatWeekPviWeekday,
  pickUnevenWeekMission,
} from '@/lib/scoring/pviGuidance';
import type { HudWeekPviMission } from '@/lib/hud/types';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';

interface WeekPacingSpreadCardProps {
  weekPviAverage: number | null;
  weekPviMissions?: HudWeekPviMission[];
}

export function WeekPacingSpreadCard({
  weekPviAverage,
  weekPviMissions = [],
}: WeekPacingSpreadCardProps) {
  const unevenMission = pickUnevenWeekMission(weekPviMissions);
  const unevenDisplay =
    unevenMission === null
      ? null
      : {
          title: resolveWorkoutTitle(unevenMission.templateId),
          pvi: unevenMission.pvi,
          durationMinutes: unevenMission.durationMinutes,
          weekdayLabel: formatWeekPviWeekday(unevenMission.lockedAt),
        };
  const pvi = describeWeeklyPviGuidance(weekPviAverage, unevenDisplay);

  return (
    <section className="card space-y-4 p-4" aria-label="Week pacing spread">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Week pacing spread
          </p>
          <HudInfoDisclosure label="week pacing spread">
            <p>
              Every mission gets a pacing score:{' '}
              <span className="font-semibold text-ink">
                (slowest round − fastest round) ÷ average round
              </span>
              , as a percentage. This is the average across the missions you locked this week. Lower
              is more even.
            </p>
            <p>
              Rounds are never compared between missions. A two-minute round in a 20-minute AMRAP is
              measured only against the other rounds of that same mission, and only the resulting
              percentages are averaged here.
            </p>
            <p>
              Each mission carries its own band — Elite Pacing, Standard, Power Leak, System Failure
              — which adjusts that mission&apos;s score. Those bands belong to a single mission, so
              this weekly average deliberately does not wear one: it would announce a failure that
              might belong to one workout out of six, without saying which.
            </p>
            <p>
              Except on the shortest missions — five minutes and under — the first round is left
              out, because everyone&apos;s opening round is fast and counting it would mark honest
              pacing as a collapse. Short missions therefore read a little higher here, and they
              have fewer rounds, so one slow round moves them further.
            </p>
            <p>
              Those four cut-offs are our own coaching judgement, not a published standard. No study
              has validated them against AMRAP performance.{' '}
              <AppLink className="link-accent" to="/science/pacing">
                What the research does say
              </AppLink>
              .
            </p>
          </HudInfoDisclosure>
        </div>
        <p className="text-display text-2xl tabular-nums text-ink">
          {weekPviAverage === null ? 'N/A' : `${weekPviAverage}%`}
        </p>
        <p className="text-xs text-secondary">average of this week&apos;s missions</p>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-secondary">{pvi.meaning}</p>
        {pvi.cause ? <p className="text-secondary">{pvi.cause}</p> : null}
        {pvi.fix ? (
          <p className="text-ink">
            <span className="font-semibold">Do this: </span>
            {pvi.fix}
          </p>
        ) : null}
      </div>
    </section>
  );
}
