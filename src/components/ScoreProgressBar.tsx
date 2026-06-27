type ScoreProgressBarProps = {
  label: string;
  value: number | null;
  max?: number;
};

export function ScoreProgressBar({ label, value, max = 9 }: ScoreProgressBarProps) {
  const hasValue = value != null && !Number.isNaN(value);
  const display = hasValue ? value.toFixed(1) : "—";
  const pct = hasValue ? (value / max) * 100 : 0;

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{display}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={hasValue ? value : undefined}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label} band score`}
        aria-valuetext={
          hasValue ? `${value.toFixed(1)} out of ${max}` : `${label} not available`
        }
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
