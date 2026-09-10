import {
  COACH_DASHBOARD_WINDOWS,
  coachDashboardWindowLabel,
  type CoachDashboardWindow,
} from '@/lib/api/coach';

interface CoachWindowPickerProps {
  value: CoachDashboardWindow;
  onChange: (window: CoachDashboardWindow) => void;
  disabled?: boolean;
}

/** Scopes every funnel, table and rate below it. The Overview strip is deliberately not scoped — its tiles name their own window. */
export function CoachWindowPicker({ value, onChange, disabled }: CoachWindowPickerProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-secondary">
      <span>Window</span>
      <select
        className="input-field w-auto text-sm"
        value={value}
        disabled={disabled}
        aria-label="Reporting window"
        onChange={(event) => onChange(event.target.value as CoachDashboardWindow)}
      >
        {COACH_DASHBOARD_WINDOWS.map((option) => (
          <option key={option} value={option}>
            {coachDashboardWindowLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
