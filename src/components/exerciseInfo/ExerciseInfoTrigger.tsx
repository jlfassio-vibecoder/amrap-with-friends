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

  const glyphClassName =
    size === 'lg'
      ? 'flex h-6 w-6 items-center justify-center rounded-full border border-border text-sm font-semibold text-secondary'
      : 'flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-secondary';

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-secondary hover:text-ink"
        aria-label={`About ${info.name}`}
        onClick={handleClick}
      >
        <span className={glyphClassName} aria-hidden="true">
          i
        </span>
      </button>
      {open ? <ExerciseInfoModal info={info} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
