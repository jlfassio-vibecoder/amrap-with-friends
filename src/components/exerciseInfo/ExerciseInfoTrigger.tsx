import { useState, type MouseEvent } from 'react';
import { getExerciseInfo } from '@/data/exerciseLibrary';
import { ExerciseInfoModal } from '@/components/exerciseInfo/ExerciseInfoModal';

interface ExerciseInfoTriggerProps {
  name: string;
  size?: 'sm' | 'lg';
}

export function ExerciseInfoTrigger({ name, size = 'sm' }: ExerciseInfoTriggerProps) {
  const info = getExerciseInfo(name);
  const [open, setOpen] = useState(false);

  if (!info) {
    return null;
  }

  const buttonClassName =
    size === 'lg'
      ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-secondary hover:border-accent hover:bg-accent-tint hover:text-ink'
      : 'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-secondary hover:border-accent hover:bg-accent-tint hover:text-ink';

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-label={`How to do ${info.name}`}
        title={`Form, cues, and tips for ${info.name}`}
        onClick={handleClick}
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold leading-none text-on-accent"
          aria-hidden="true"
        >
          ?
        </span>
        How to
      </button>
      {open ? <ExerciseInfoModal info={info} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
