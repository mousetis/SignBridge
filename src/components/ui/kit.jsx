// Bộ thành phần nhỏ dùng chung: Segmented, Badge, Avatar, Stat, EmptyState, Skeleton, Confetti, Field.
import { useEffect, useMemo } from 'react';

/** Nhóm nút chọn một (radio). options: [{id, label, icon?, hint?}] */
export function Segmented({ options, value, onChange, label, className = '', size = 'md', role = 'radiogroup' }) {
  const item = role === 'tablist' ? 'tab' : 'radio';
  return (
    <div role={role} aria-label={label} className={`inline-flex max-w-full flex-wrap gap-1.5 rounded-2xl border border-rule bg-card2 p-1.5 ${className}`}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role={item}
            aria-checked={item === 'radio' ? on : undefined}
            aria-selected={item === 'tab' ? on : undefined}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={`inline-flex ${size === 'sm' ? 'min-h-[48px]' : 'min-h-[56px]'} items-center gap-2 rounded-xl px-4 font-display text-[0.98rem] font-semibold transition ${on ? 'bg-primary text-primary-on shadow-lift' : 'text-ink hover:bg-card'}`}
          >
            {o.icon && <o.icon className="h-5 w-5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const TONES = {
  neutral: 'border-rule bg-card2 text-ink',
  ok: 'border-ok bg-ok-soft text-ink',
  warn: 'border-warn bg-warn-soft text-ink',
  bad: 'border-bad bg-bad-soft text-ink',
  info: 'border-info bg-info-soft text-ink',
  primary: 'border-primary bg-primary text-primary-on',
  marker: 'border-transparent bg-marker text-[#101428]',
};
export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.85rem] font-semibold ${TONES[tone]} ${className}`}>
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name = '?', color = '#3A3FCF', size = 40 }) {
  const ini = name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {ini}
    </span>
  );
}

export function Stat({ icon: Icon, label, value, tone = 'neutral', sub }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${TONES[tone] || TONES.neutral}`}>
      {Icon && <Icon className="h-7 w-7 shrink-0" aria-hidden />}
      <div className="leading-tight">
        <div className="font-display text-[1.45rem] font-semibold tabular-nums">{value}</div>
        <div className="text-[0.82rem] font-medium opacity-80">{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-10 text-center">
      {Icon && <Icon className="h-12 w-12 text-accent" aria-hidden />}
      <h3 className="text-[1.2rem]">{title}</h3>
      {children && <p className="max-w-md text-muted">{children}</p>}
      {action}
    </div>
  );
}

export const Skeleton = ({ className = 'h-24' }) => <div className={`skeleton ${className}`} aria-hidden />;

export const FIELD = 'min-h-[64px] w-full rounded-2xl border-2 border-line bg-card px-4 text-[1.08rem] font-semibold text-ink placeholder:font-medium placeholder:text-muted disabled:bg-card2 disabled:text-muted';
export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.95rem] font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.85rem] text-muted">{hint}</span>}
    </label>
  );
}

/** Pháo giấy ăn mừng (CSS thuần). Tự gỡ sau 3 giây; tắt khi người dùng chọn giảm chuyển động. */
export function Confetti({ onDone, count = 48 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.8 + Math.random() * 1.4,
    color: ['#FFC93C', '#5B61F0', '#54D6C8', '#FF8FA3', '#74EAAC'][i % 5], rot: Math.random() * 360, w: 6 + Math.random() * 8,
  })), [count]);
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 3400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span key={p.id} className="absolute top-0 block rounded-[2px]" style={{ left: `${p.left}%`, width: p.w, height: p.w * 1.6, background: p.color, transform: `rotate(${p.rot}deg)`, animation: `confetti ${p.dur}s ${p.delay}s ease-in forwards` }} />
      ))}
    </div>
  );
}
