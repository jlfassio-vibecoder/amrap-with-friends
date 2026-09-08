import { useState } from 'react';
import {
  AMQAP_DOMAIN_GUIDANCE,
  AMQAP_FLOW_CATEGORIES,
  AMQAP_FLOWS,
  AMQAP_TIME_DOMAINS,
  type AmqapFlowId,
  type AmqapTimeDomain,
} from '@/data/amqapFlows';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { filterAmqapFlows } from '@/lib/workout/filterAmqapFlows';
import { WorkoutTemplateCard } from '@/components/createMission/WorkoutTemplateCard';
import { AmqapInfoModal } from '@/components/createMission/AmqapInfoModal';

interface AmqapFlowPickerProps {
  durationMinutes: AmqapTimeDomain;
  selectedFlowId: AmqapFlowId;
  selectedTemplateIds: string[];
  onDurationChange: (duration: AmqapTimeDomain) => void;
  onFlowChange: (flowId: AmqapFlowId) => void;
  onTemplateSelect: (template: WorkoutTemplate) => void;
}

function chipClassName(selected: boolean): string {
  return selected
    ? 'rounded-full bg-accent pr-2 text-sm font-semibold text-on-accent'
    : 'hover:border-accent/40 rounded-full border border-border bg-surface pr-2 text-sm font-semibold text-ink';
}

export function AmqapFlowPicker({
  durationMinutes,
  selectedFlowId,
  selectedTemplateIds,
  onDurationChange,
  onFlowChange,
  onTemplateSelect,
}: AmqapFlowPickerProps) {
  const [infoDomain, setInfoDomain] = useState<AmqapTimeDomain | null>(null);
  const [infoFlowId, setInfoFlowId] = useState<AmqapFlowId | null>(null);

  const selectedCategory = AMQAP_FLOW_CATEGORIES.find((category) => category.id === selectedFlowId);
  const visibleFlows = filterAmqapFlows(AMQAP_FLOWS, {
    durationMinutes,
    flowId: selectedFlowId,
  });
  const infoFlow = infoFlowId
    ? AMQAP_FLOW_CATEGORIES.find((category) => category.id === infoFlowId)
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">AMQAP</h2>
        <p className="text-sm text-secondary">
          As many quality rounds as possible. Continuous mobility, not a race. Move slowly, stay in
          the flow, and ignore the scoreboard.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Time domain</p>
        <div className="flex flex-wrap gap-2">
          {AMQAP_TIME_DOMAINS.map((duration) => {
            const selected = durationMinutes === duration;
            return (
              <div
                key={duration}
                className={`inline-flex items-center gap-1.5 ${chipClassName(selected)}`}
              >
                <button
                  type="button"
                  className="bg-transparent py-2 pl-4 text-inherit"
                  onClick={() => onDurationChange(duration)}
                >
                  {duration} min
                </button>
                <button
                  type="button"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none hover:opacity-80 ${
                    selected ? 'bg-on-accent text-accent' : 'bg-accent text-on-accent'
                  }`}
                  aria-label={`What's the ${duration} min quality flow?`}
                  title={`Learn what the ${duration} min quality flow is for`}
                  onClick={() => setInfoDomain(duration)}
                >
                  ?
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Flow</p>
        <div className="flex flex-wrap gap-2">
          {AMQAP_FLOW_CATEGORIES.map((category) => {
            const selected = selectedFlowId === category.id;
            return (
              <div
                key={category.id}
                className={`inline-flex items-center gap-1.5 ${chipClassName(selected)}`}
              >
                <button
                  type="button"
                  className="bg-transparent py-2 pl-4 text-inherit"
                  onClick={() => onFlowChange(category.id)}
                >
                  {category.label}
                </button>
                <button
                  type="button"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none hover:opacity-80 ${
                    selected ? 'bg-on-accent text-accent' : 'bg-accent text-on-accent'
                  }`}
                  aria-label={`What's ${category.label}?`}
                  title={`Learn what the ${category.label} flow is for`}
                  onClick={() => setInfoFlowId(category.id)}
                >
                  ?
                </button>
              </div>
            );
          })}
        </div>
        {selectedCategory ? (
          <p className="text-sm text-secondary">{selectedCategory.description}</p>
        ) : null}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {visibleFlows.map((flow) => (
          <li key={flow.id}>
            <WorkoutTemplateCard
              template={flow}
              selected={selectedTemplateIds.includes(flow.id)}
              onSelect={onTemplateSelect}
            />
          </li>
        ))}
      </ul>

      {infoDomain !== null ? (
        <AmqapInfoModal
          title={AMQAP_DOMAIN_GUIDANCE[infoDomain].title}
          body={AMQAP_DOMAIN_GUIDANCE[infoDomain].body}
          onClose={() => setInfoDomain(null)}
        />
      ) : null}

      {infoFlow ? (
        <AmqapInfoModal
          title={infoFlow.label}
          body={infoFlow.description}
          onClose={() => setInfoFlowId(null)}
        />
      ) : null}
    </div>
  );
}
