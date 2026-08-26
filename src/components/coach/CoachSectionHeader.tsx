interface CoachSectionHeaderProps {
  title: string;
}

function refreshCoachPage() {
  window.location.reload();
}

export function CoachSectionHeader({ title }: CoachSectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <button
        type="button"
        className="btn-outline px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
        onClick={refreshCoachPage}
        aria-label={`Refresh ${title}`}
      >
        Refresh
      </button>
    </div>
  );
}

export { refreshCoachPage };
