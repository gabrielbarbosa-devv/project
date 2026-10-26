type Props = {
  totalCount: number;
  completedCount: number;
};

/** Read-only checklist progress for compact task cards. */
export function TaskChecklistProgress({ totalCount, completedCount }: Props) {
  const total = Number.isFinite(totalCount) ? Math.max(0, Math.floor(totalCount)) : 0;
  if (total === 0) return null;

  const completed = Number.isFinite(completedCount)
    ? Math.min(total, Math.max(0, Math.floor(completedCount)))
    : 0;
  const percentage = Math.round((completed / total) * 100);
  const circumference = 2 * Math.PI * 8;
  const offset = circumference * (1 - completed / total);

  return (
    <div
      role="progressbar"
      aria-label="Checklist"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-valuetext={`Checklist: ${completed} de ${total} itens concluídos, ${percentage}%.`}
      className="inline-flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-text-faint"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] shrink-0 -rotate-90">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ color: "var(--platform-blue)" }}
        />
      </svg>
      <span aria-hidden="true">{completed}/{total}</span>
    </div>
  );
}
