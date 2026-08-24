interface HonestyLockCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const LABEL_ID = 'honesty-lock-label';

export function HonestyLockCheckbox({
  checked,
  onChange,
  disabled = false,
}: HonestyLockCheckboxProps) {
  return (
    <label
      htmlFor="honesty-lock-checkbox"
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-card border p-3 ${
        checked
          ? 'border-accent bg-accent-tint'
          : 'border-border bg-page'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        id="honesty-lock-checkbox"
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        checked={checked}
        disabled={disabled}
        aria-describedby={LABEL_ID}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span id={LABEL_ID} className="text-sm leading-snug text-ink">
        I executed every rep with full range of motion. I took no shortcuts.
      </span>
    </label>
  );
}
