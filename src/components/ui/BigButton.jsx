// Nút bấm tối thiểu 64 px (WCAG / đặc tả trợ năng), tương phản AAA ở cả 3 chủ đề.
const VARIANTS = {
  primary: 'border-transparent bg-primary text-primary-on shadow-press hover:bg-primary-hover',
  ok: 'border-ok bg-ok-soft text-ink hover:brightness-95',
  warn: 'border-warn bg-warn-soft text-ink hover:brightness-95',
  bad: 'border-bad bg-bad-soft text-ink hover:brightness-95',
  secondary: 'border-line bg-card text-ink hover:bg-card2',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-card2',
  danger: 'border-transparent bg-bad text-paper hover:brightness-110',
};

export default function BigButton({ icon: Icon, children, variant = 'secondary', size = 'md', active = false, className = '', iconOnly = false, type = 'button', ...props }) {
  const look = active ? 'border-primary bg-primary text-primary-on shadow-press' : VARIANTS[variant] || VARIANTS.secondary;
  const h = size === 'sm' ? 'min-h-[52px] min-w-[52px]' : 'min-h-[64px] min-w-[64px]';
  return (
    <button
      type={type}
      {...props}
      aria-pressed={active && props.role !== 'radio' && props.role !== 'tab' ? true : undefined}
      className={`inline-flex ${h} select-none items-center justify-center gap-2.5 rounded-2xl border-2 font-display text-[1rem] font-semibold leading-tight transition duration-150 active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 ${iconOnly ? 'px-0' : 'px-5'} ${look} ${className}`}
    >
      {Icon && <Icon className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  );
}
