import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Play } from 'lucide-react';
import Dialog from '../ui/Dialog.jsx';
import BigButton from '../ui/BigButton.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import { useEsp32 } from '../../context/Esp32Context.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { calibrateBreath } from '../../lib/esp32/breath.js';
import { useT } from '../../i18n/index.jsx';

const STEPS = ['rest', 'puff', 'sip'];
const SECONDS = 4;

/** Trình hướng dẫn hiệu chỉnh hơi thở: nghỉ → thổi → hút (mỗi bước 4 giây), rồi đề xuất ngưỡng riêng cho người dùng. */
export default function BreathWizard({ open, onClose }) {
  const { t } = useT();
  const { tel, snap, pushConfig } = useEsp32();
  const { patch } = useSettings();
  const { notify } = useToast();
  const [step, setStep] = useState(-1); // -1: giới thiệu, 0..2: đang đo, 3: kết quả
  const [left, setLeft] = useState(SECONDS);
  const [data, setData] = useState({ rest: [], puff: [], sip: [] });
  const [live, setLive] = useState(0);
  const timer = useRef(null);
  const connected = snap.state === 'connected';

  useEffect(() => { if (!open) { clearInterval(timer.current); setStep(-1); setData({ rest: [], puff: [], sip: [] }); } }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const i = setInterval(() => setLive(tel.current.kpa), 80);
    return () => clearInterval(i);
  }, [open, tel]);

  const run = (idx, acc) => {
    setStep(idx);
    setLeft(SECONDS);
    const t0 = performance.now();
    const samples = [];
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      if (el > 0.8) samples.push(tel.current.kpa); // bỏ 0,8 giây đầu (thời gian phản ứng)
      setLeft(Math.max(0, Math.ceil(SECONDS - el)));
      if (el >= SECONDS) {
        clearInterval(timer.current);
        const next = { ...acc, [STEPS[idx]]: samples };
        setData(next);
        if (idx < 2) run(idx + 1, next);
        else setStep(3);
      }
    }, 50);
  };
  useEffect(() => () => clearInterval(timer.current), []);

  const res = step === 3 ? calibrateBreath(data) : null;
  const apply = () => {
    patch('pressure', { puff: res.puff, sip: res.sip });
    setTimeout(pushConfig, 250);
    notify(t('breath.applied'), 'ok');
    onClose();
  };
  const pos = (v) => `${Math.max(0, Math.min(100, 50 + (v / 2) * 50))}%`;

  return (
    <Dialog open={open} onClose={onClose} title={t('breath.title')}>
      {!connected && <p className="mb-4 rounded-xl border border-warn bg-warn-soft p-3 font-semibold">{t('breath.needDevice')}</p>}
      <div className="relative mb-5 h-10 overflow-hidden rounded-xl border-2 border-line bg-card2" aria-label={t('esp.pressure')}>
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-line" />
        <div className="absolute inset-y-1 rounded-md bg-primary" style={{ left: live >= 0 ? '50%' : pos(live), width: `${Math.min(50, (Math.abs(live) / 2) * 50)}%` }} />
        <span className="absolute right-3 top-1.5 font-mono text-sm font-bold tabular-nums">{live.toFixed(2)} kPa</span>
      </div>
      {step === -1 && (
        <>
          <p className="mb-5 leading-relaxed">{t('breath.intro', { s: SECONDS })}</p>
          <BigButton icon={Play} variant="primary" disabled={!connected} onClick={() => run(0, { rest: [], puff: [], sip: [] })}>{t('common.start')}</BigButton>
        </>
      )}
      {step >= 0 && step < 3 && (
        <div className="text-center">
          <p className="kicker">{t('breath.step', { n: step + 1, total: 3 })}</p>
          <p className="my-2 font-display text-[2rem] font-semibold">{t(`breath.do.${STEPS[step]}`)}</p>
          <p className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-primary font-display text-[2.6rem] font-bold tabular-nums">{left}</p>
          <ProgressBar value={(SECONDS - left) / SECONDS} label={t('breath.measuring')} />
        </div>
      )}
      {res && (
        <div className="grid gap-4">
          {res.ok ? (
            <p className="flex items-center gap-2 font-semibold text-ok"><Check className="h-5 w-5" aria-hidden /> {t('breath.good')}</p>
          ) : (
            <ul className="grid gap-1 rounded-xl border border-warn bg-warn-soft p-3 font-semibold">
              {res.issues.map((i) => <li key={i}>• {t(`breath.issue.${i}`)}</li>)}
            </ul>
          )}
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[['puff', res.puff], ['sip', res.sip], ['noise', `±${res.noise}`]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-card2 p-3"><dt className="text-[0.85rem] text-muted">{t(`breath.res.${k}`)}</dt><dd className="font-mono text-[1.2rem] font-bold">{v}</dd></div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3">
            <BigButton icon={Check} variant="primary" onClick={apply}>{t('breath.apply')}</BigButton>
            <BigButton icon={RotateCcw} onClick={() => { setStep(-1); setData({ rest: [], puff: [], sip: [] }); }}>{t('breath.again')}</BigButton>
          </div>
        </div>
      )}
    </Dialog>
  );
}
