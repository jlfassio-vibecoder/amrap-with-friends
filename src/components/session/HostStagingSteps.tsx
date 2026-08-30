import { useEffect, useId, useState, type ReactNode } from 'react';
import { LOBBY_COUNTDOWN_MAX_SECONDS } from '@/lib/session/lobbyCountdown';
import { setLobbyCountdown } from '@/lib/api/sessionSync';
import { getStoredHostToken } from '@/lib/sessionIdentity';
import { GhostPicker } from '@/components/GhostPicker';
import { useCopySessionInvite } from '@/components/session/useCopySessionInvite';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import type { StoredGhostSelection } from '@/lib/sessionIdentity';
import { ogCardFromSex } from '@/lib/share/ogCard';

const PRESET_SECONDS = [
  { label: '2 MIN', seconds: 120 },
  { label: '5 MIN', seconds: 300 },
  { label: '10 MIN', seconds: 600 },
] as const;

type ExpandedStep = 0 | 1 | 2 | null;

export interface HostStagingStepsProps {
  sessionId: string;
  lobbyId?: string | null;
  countdownArmed: boolean;
  actionsEnabled?: boolean;
  onAudioUnlock?: () => void;
  showPacer: boolean;
  templateId: string | null;
  durationMinutes: number;
  ghostSelection: StoredGhostSelection | null;
  onGhostChange: (selection: StoredGhostSelection | null) => void;
}

function durationSummaryLabel(seconds: number): string {
  const preset = PRESET_SECONDS.find((entry) => entry.seconds === seconds);
  return preset ? preset.label : `${seconds} sec`;
}

export function HostStagingSteps({
  sessionId,
  lobbyId = null,
  countdownArmed,
  actionsEnabled = true,
  onAudioUnlock,
  showPacer,
  templateId,
  durationMinutes,
  ghostSelection,
  onGhostChange,
}: HostStagingStepsProps) {
  const baseId = useId();
  const [expandedStep, setExpandedStep] = useState<ExpandedStep>(() =>
    countdownArmed ? null : 0
  );
  const [selectedSeconds, setSelectedSeconds] = useState(300);
  const [customSeconds, setCustomSeconds] = useState('300');
  const [busy, setBusy] = useState(false);
  const [engageError, setEngageError] = useState<string | null>(null);
  const { profile } = useAthleteProfile();
  const {
    secured,
    idSecured,
    error: copyError,
    copyInvite,
    copySessionId,
  } = useCopySessionInvite(sessionId, lobbyId, ogCardFromSex(profile?.biologicalSex));

  useEffect(() => {
    if (countdownArmed) {
      setExpandedStep(null);
    }
  }, [countdownArmed]);

  function toggleStep(index: 0 | 1 | 2) {
    setExpandedStep((current) => (current === index ? null : index));
  }

  function selectPreset(seconds: number) {
    setSelectedSeconds(seconds);
    setCustomSeconds(String(seconds));
  }

  function applyCustomSeconds(raw: string) {
    setCustomSeconds(raw);
    const parsed = Number(raw);
    if (
      Number.isInteger(parsed) &&
      parsed > 0 &&
      parsed <= LOBBY_COUNTDOWN_MAX_SECONDS
    ) {
      setSelectedSeconds(parsed);
    }
  }

  async function engageClock() {
    onAudioUnlock?.();
    const hostToken = getStoredHostToken(sessionId);
    if (!hostToken) {
      setEngageError('Host credentials are missing. Reopen the session as host.');
      return;
    }
    setBusy(true);
    setEngageError(null);
    try {
      const result = await setLobbyCountdown({
        sessionId,
        hostToken,
        seconds: selectedSeconds,
      });
      if (result.error) {
        setEngageError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const pacerSummary = ghostSelection?.label?.trim()
    ? ghostSelection.label
    : 'None ›';

  const steps: Array<{
    index: 0 | 1 | 2;
    label: string;
    walkthroughId: string;
    summary: ReactNode;
    body: ReactNode;
    visible: boolean;
  }> = [
    {
      index: 0,
      label: 'Set duration',
      walkthroughId: 't-minus',
      visible: true,
      summary: (
        <span className="text-xs text-muted tabular-nums">
          {durationSummaryLabel(selectedSeconds)}
        </span>
      ),
      body: countdownArmed ? null : (
        <div className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_SECONDS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                className={
                  selectedSeconds === preset.seconds
                    ? 'rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-on-accent'
                    : 'rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-secondary hover:text-ink'
                }
                onClick={() => selectPreset(preset.seconds)}
              >
                {preset.label}
              </button>
            ))}
            <label className="ml-auto flex min-w-[7.5rem] flex-1 items-center gap-2 sm:max-w-[11rem]">
              <span className="sr-only">Custom seconds (1–600)</span>
              <input
                className="input-field py-1 text-sm tabular-nums"
                type="number"
                min={1}
                max={LOBBY_COUNTDOWN_MAX_SECONDS}
                aria-label="Custom seconds (1–600)"
                placeholder="sec"
                value={customSeconds}
                onChange={(event) => applyCustomSeconds(event.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="btn-primary w-full px-3 py-1.5 text-xs uppercase tracking-widest"
            disabled={
              busy ||
              !actionsEnabled ||
              !Number.isInteger(selectedSeconds) ||
              selectedSeconds <= 0 ||
              selectedSeconds > LOBBY_COUNTDOWN_MAX_SECONDS
            }
            onClick={() => void engageClock()}
          >
            {busy ? 'Starting…' : 'Start countdown'}
          </button>
          {engageError ? <p className="text-error text-sm">{engageError}</p> : null}
        </div>
      ),
    },
    {
      index: 1,
      label: 'Share session',
      walkthroughId: 'rally-link',
      visible: true,
      summary: (
        <span className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="link-accent text-xs font-medium"
            onClick={() => void copyInvite()}
          >
            {secured ? 'Link copied' : 'Copy link'}
          </button>
          <button
            type="button"
            className="link-accent text-xs font-medium"
            onClick={() => void copySessionId()}
          >
            {idSecured ? 'ID copied' : 'Copy session ID'}
          </button>
        </span>
      ),
      body: (
        <div className="space-y-2 pb-3">
          <button
            type="button"
            className="btn-primary w-full px-3 py-1.5 text-xs uppercase tracking-widest"
            onClick={() => void copyInvite()}
          >
            {secured ? 'LINK COPIED' : 'COPY RALLY LINK'}
          </button>
          <button
            type="button"
            className="btn-outline w-full px-3 py-1.5 text-xs uppercase tracking-widest"
            onClick={() => void copySessionId()}
          >
            {idSecured ? 'ID COPIED' : 'COPY SESSION ID'}
          </button>
          {copyError ? <p className="text-error text-sm">{copyError}</p> : null}
        </div>
      ),
    },
    {
      index: 2,
      label: 'Select pacer',
      walkthroughId: 'pacer',
      visible: showPacer && Boolean(templateId),
      summary: (
        <span className="max-w-[12rem] truncate text-xs text-muted">{pacerSummary}</span>
      ),
      body:
        showPacer && templateId ? (
          <div className="pb-3">
            <GhostPicker
              sessionId={sessionId}
              templateId={templateId}
              durationMinutes={durationMinutes}
              value={ghostSelection}
              onChange={onGhostChange}
              embedded
            />
          </div>
        ) : null,
    },
  ];

  const visibleSteps = steps.filter((step) => step.visible);

  return (
    <div className="rounded-card border border-border bg-page/40">
      {visibleSteps.map((step, order) => {
        const expanded = expandedStep === step.index;
        const panelId = `${baseId}-panel-${step.index}`;
        const isLast = order === visibleSteps.length - 1;
        return (
          <div
            key={step.index}
            className={isLast ? undefined : 'border-b border-border'}
            data-walkthrough-id={step.walkthroughId}
          >
            <div className="flex w-full items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleStep(step.index)}
              >
                <span
                  className={
                    expanded
                      ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent'
                      : 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-bold text-muted'
                  }
                  aria-hidden
                >
                  {order + 1}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">
                  {step.label}
                </span>
              </button>
              {!expanded ? <span className="shrink-0">{step.summary}</span> : null}
            </div>
            <div id={panelId} hidden={!expanded} className="px-3">
              {expanded ? step.body : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
