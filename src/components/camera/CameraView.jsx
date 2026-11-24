import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, VideoOff, HandMetal, FlipHorizontal2, SwitchCamera } from 'lucide-react';
import { useHandTracker } from '../../hooks/useHandTracker.js';
import { drawHand } from '../../lib/ui/drawHand.js';
import BigButton from '../ui/BigButton.jsx';
import { localhostUrl } from '../../lib/ui/secureContext.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT } from '../../i18n/index.jsx';

const BORDER = {
  idle: 'border-line',
  ok: 'border-ok shadow-[0_0_0_6px_rgb(var(--ok)/0.25)]',
  warn: 'border-warn shadow-[0_0_0_6px_rgb(var(--warn)/0.25)]',
  bad: 'border-bad shadow-[0_0_0_6px_rgb(var(--bad)/0.25)]',
};
const chip = 'rounded-full bg-stage/80 px-3 py-1.5 text-[0.9rem] font-bold text-onstage backdrop-blur';
const Corner = ({ pos }) => <span aria-hidden className={`pointer-events-none absolute h-6 w-6 border-white/80 ${pos}`} />;

/**
 * Camera + khung xương AI theo thời gian thực. onFrame(lm, W, H, ts, {hands}) có thể trả về { jointColors }.
 * `maxHands` = 2 cho từ/cụm từ cần hai tay. Camera và lật gương lấy từ cài đặt.
 */
export default function CameraView({ enabled = true, onFrame, border = 'idle', children, className = '', maxHands = 1, aspect = 'aspect-[4/3]', controls = true }) {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [retry, setRetry] = useState(0);
  const [hand, setHand] = useState(false);
  const handRef = useRef(false);
  const missing = useRef(0);
  const mirror = settings.mirror;

  const frame = useCallback((lm, W, H, ts, extra) => {
    const opts = onFrame?.(lm, W, H, ts, extra) || {};
    if (canvasRef.current) drawHand(canvasRef.current, lm, { ...opts, W, H, hands: extra?.hands });
    if (lm) missing.current = 0;
    else missing.current++;
    const present = !!lm || missing.current < 8;
    if (present !== handRef.current) {
      handRef.current = present;
      setHand(present);
    }
  }, [onFrame]);

  const { status, error, errorCode, fps, cameras } = useHandTracker({ enabled, videoRef, onFrame: frame, retryKey: retry, deviceId: settings.cameraId, maxHands });
  const flip = mirror ? { transform: 'scaleX(-1)' } : undefined;

  return (
    <div className={`relative overflow-hidden rounded-3xl border-[3px] bg-stage transition-shadow duration-150 ${BORDER[border]} ${className}`}>
      <div className={`${aspect} w-full`} style={flip}>
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label={t('common.camera')} />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      </div>
      <Corner pos="left-3 top-3 border-l-[3px] border-t-[3px] rounded-tl-lg" />
      <Corner pos="right-3 top-3 border-r-[3px] border-t-[3px] rounded-tr-lg" />
      <Corner pos="bottom-3 left-3 border-b-[3px] border-l-[3px] rounded-bl-lg" />
      <Corner pos="bottom-3 right-3 border-b-[3px] border-r-[3px] rounded-br-lg" />

      {!enabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card2 text-center text-[1.1rem] font-bold text-muted">
          <VideoOff className="h-12 w-12" aria-hidden /> {t('camera.off')}
        </div>
      )}
      {enabled && status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card2 px-6 text-center text-[1.1rem] font-bold text-ink">
          <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden /> {t('camera.opening')}
        </div>
      )}
      {enabled && status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-bad-soft p-6 text-center">
          <VideoOff className="h-12 w-12 shrink-0 text-bad" aria-hidden />
          <p className="max-w-md text-[1.05rem] font-bold leading-snug text-ink">{error}</p>
          {errorCode === 'insecure' && location.protocol !== 'file:' ? (
            <a href={localhostUrl()} className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-[1.1rem] font-bold text-primary-on shadow-press">{t('camera.localhost')}</a>
          ) : (
            <BigButton icon={RefreshCw} variant="primary" onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</BigButton>
          )}
        </div>
      )}
      {enabled && status === 'running' && (
        <>
          <div className={`absolute left-5 top-5 flex items-center gap-2 ${chip}`}>
            <Camera className="h-4 w-4" aria-hidden /> <span className="font-mono tabular-nums">{fps}</span> {t('camera.fps')}
          </div>
          {controls && (
            <div className="absolute right-5 top-5 flex items-center gap-2">
              {cameras.length > 1 && (
                <label className={`${chip} flex items-center gap-1.5`}>
                  <SwitchCamera className="h-4 w-4" aria-hidden />
                  <select aria-label={t('camera.choose')} value={settings.cameraId} onChange={(e) => patch(null, { cameraId: e.target.value })} className="max-w-[9rem] bg-transparent text-[0.85rem] font-bold outline-none">
                    <option value="" className="text-black">{t('camera.default')}</option>
                    {cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId} className="text-black">{c.label || `Camera ${i + 1}`}</option>)}
                  </select>
                </label>
              )}
              <button type="button" aria-pressed={mirror} aria-label={t('camera.mirror')} title={t('camera.mirror')} onClick={() => patch(null, { mirror: !mirror })} className={`${chip} flex h-9 w-9 items-center justify-center !p-0 ${mirror ? '!bg-primary !text-primary-on' : ''}`}>
                <FlipHorizontal2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
          {!hand && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-marker px-5 py-3 text-[1rem] font-bold text-[#101428] shadow-lift">
              <HandMetal className="h-6 w-6" aria-hidden /> {t('camera.noHand')}
            </div>
          )}
        </>
      )}
      {enabled && status === 'running' && children}
    </div>
  );
}
