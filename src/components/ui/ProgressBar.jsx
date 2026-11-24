export default function ProgressBar({ value = 0, label, color = 'bg-primary', big = false, className = '', showValue = false }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[0.92rem] font-semibold">
          <span>{label}</span>
          {showValue && <span className="font-mono tabular-nums text-muted">{pct}%</span>}
        </div>
      )}
      <div className={`overflow-hidden rounded-full border border-line/60 bg-card2 ${big ? 'h-6' : 'h-3.5'}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full transition-[width] duration-150 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
