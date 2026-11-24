export default function Toggle({ label, checked, onChange, hint, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[64px] w-full items-center justify-between gap-4 rounded-2xl border-2 border-line bg-card px-4 py-3 text-left transition hover:bg-card2 disabled:opacity-45"
    >
      <span>
        <span className="block text-[1.02rem] font-semibold leading-tight">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.92rem] text-muted">{hint}</span>}
      </span>
      <span aria-hidden className={`relative h-9 w-16 shrink-0 rounded-full border-2 transition ${checked ? 'border-primary bg-primary' : 'border-line bg-card2'}`}>
        <span className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full shadow transition-all ${checked ? 'left-[2.1rem] bg-primary-on' : 'left-1.5 bg-line'}`} />
      </span>
    </button>
  );
}
