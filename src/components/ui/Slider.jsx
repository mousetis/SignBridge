import { useCallback, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import BigButton from './BigButton.jsx';
import { useT } from '../../i18n/index.jsx';

/**
 * Thanh trượt tự dựng: kéo được bằng pointer thật lẫn pointer ảo do ESP32 phát ra
 * (lắng nghe ở cấp window). Có nút − / + 64 px để chỉnh chỉ bằng thao tác bấm.
 */
export default function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, format, hint }) {
  const { t } = useT();
  const track = useRef(null);
  const dragging = useRef(false);
  const round = (v) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const fix = (v) => Number(v.toFixed(4));

  const setFromX = useCallback((clientX) => {
    const r = track.current.getBoundingClientRect();
    const k = (clientX - r.left) / r.width;
    onChange(fix(round(min + Math.min(1, Math.max(0, k)) * (max - min))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step, onChange]);

  const down = (e) => {
    dragging.current = true;
    setFromX(e.clientX);
    const move = (ev) => dragging.current && setFromX(ev.clientX);
    const up = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const key = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(fix(round(value + step)));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(fix(round(value - step)));
    else return;
    e.preventDefault();
  };

  const pct = ((value - min) / (max - min)) * 100;
  const shown = format ? format(value) : `${value}${unit}`;
  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between gap-4">
        <span className="text-[1.02rem] font-semibold">{label}</span>
        <span className="rounded-lg bg-marker px-3 py-1 font-mono text-[1.05rem] font-bold tabular-nums text-[#101428]">{shown}</span>
      </div>
      <div className="flex items-center gap-3">
        <BigButton iconOnly icon={Minus} aria-label={`${t('slider.less')} ${label}`} onClick={() => onChange(fix(round(value - step)))} />
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={shown}
          onPointerDown={down}
          onKeyDown={key}
          className="relative h-16 flex-1 cursor-pointer touch-none select-none rounded-2xl border-2 border-line bg-card2"
        >
          <div className="absolute inset-y-0 left-0 rounded-l-2xl bg-primary/20" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-11 w-7 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-card bg-primary shadow-lift" style={{ left: `${pct}%` }} />
        </div>
        <BigButton iconOnly icon={Plus} aria-label={`${t('slider.more')} ${label}`} onClick={() => onChange(fix(round(value + step)))} />
      </div>
      {hint && <p className="mt-2 text-[0.95rem] text-muted">{hint}</p>}
    </div>
  );
}
