import { useEffect, useRef } from 'react';
import { useEsp32 } from '../../context/Esp32Context.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT } from '../../i18n/index.jsx';

/** Hiển thị trực quan dữ liệu 20 ms: vị trí Joystick 4 trục và áp suất thổi/hút (kPa). */
export default function TelemetryPanel() {
  const { t } = useT();
  const { tel } = useEsp32();
  const { settings } = useSettings();
  const dot = useRef(null);
  const bar = useRef(null);
  const txt = useRef(null);
  const evt = useRef(null);
  const { puff, sip } = settings.pressure;

  useEffect(() => {
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const T = tel.current;
      if (dot.current) dot.current.style.transform = `translate(${T.fx * 56}px, ${T.fy * 56}px)`;
      if (bar.current) {
        const k = Math.max(-2, Math.min(2, T.kpa));
        bar.current.style.left = `${k >= 0 ? 50 : 50 + (k / 2) * 50}%`;
        bar.current.style.width = `${Math.abs(k / 2) * 50}%`;
        bar.current.style.background = k >= puff ? 'rgb(var(--ok))' : k <= sip ? 'rgb(var(--warn))' : 'rgb(var(--line))';
      }
      if (txt.current) txt.current.textContent = `${T.kpa.toFixed(2)} kPa`;
      if (evt.current) evt.current.textContent = performance.now() - T.eventAt < 1200 && T.event ? T.event : '—';
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [tel, puff, sip]);

  const pos = (k) => `${50 + (k / 2) * 50}%`;
  return (
    <div className="grid gap-6 rounded-2xl border border-rule bg-card2/50 p-4 sm:grid-cols-[auto_1fr]">
      <div>
        <p className="mb-2 font-semibold">{t('esp.joystick')}</p>
        <div className="relative mx-auto h-36 w-36 rounded-full border-2 border-line bg-card">
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-line/40" />
          <div className="absolute left-0 top-1/2 h-0.5 w-full bg-line/40" />
          <div ref={dot} className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 rounded-full border-2 border-card bg-primary shadow-lift" />
        </div>
      </div>
      <div>
        <p className="mb-2 flex justify-between font-semibold">
          <span>{t('esp.pressure')}</span>
          <span ref={txt} className="font-mono tabular-nums text-accent" />
        </p>
        <div className="relative h-12 overflow-hidden rounded-xl border-2 border-line bg-card">
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-line" />
          <div className="absolute inset-y-0 w-1 bg-ok" style={{ left: pos(puff) }} title={t('esp.puffThr')} />
          <div className="absolute inset-y-0 w-1 bg-marker" style={{ left: pos(sip) }} title={t('esp.sipThr')} />
          <div ref={bar} className="absolute inset-y-0" />
        </div>
        <div className="mt-1 flex justify-between text-[0.9rem] text-muted"><span>−2 ({t('esp.sip')})</span><span>0</span><span>+2 ({t('esp.puff')})</span></div>
        <p className="mt-3">{t('esp.lastEvent')} <strong ref={evt} className="rounded-md bg-marker px-2 py-1 font-mono text-[#101428]">—</strong></p>
      </div>
    </div>
  );
}
