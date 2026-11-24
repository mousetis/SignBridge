import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n/index.jsx';

/** Đèn trạng thái ESP32: luôn có MÀU + BIỂU TƯỢNG + CHỮ (không dựa vào màu hay âm thanh). */
export default function StatusLight({ state, stale = false, extra, className = '' }) {
  const { t } = useT();
  const cfg = stale && state === 'connected'
    ? { Icon: AlertTriangle, cls: 'border-warn bg-warn-soft', text: t('device.stale') }
    : state === 'connected'
      ? { Icon: Wifi, cls: 'border-ok bg-ok-soft', text: t('device.connected') }
      : state === 'connecting'
        ? { Icon: Loader2, cls: 'border-info bg-info-soft', text: t('device.connecting'), spin: true }
        : { Icon: WifiOff, cls: 'border-line bg-card2', text: t('device.disconnected') };
  return (
    <span className={`inline-flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-4 py-2 text-ink ${cfg.cls} ${className}`} role="status">
      <cfg.Icon className={`h-6 w-6 shrink-0 ${cfg.spin ? 'animate-spin' : ''}`} aria-hidden />
      <span className="min-w-0 leading-tight">
        <span className="block font-display text-[0.98rem] font-semibold">{cfg.text}</span>
        {extra && <span className="block truncate text-[0.82rem] text-muted">{extra}</span>}
      </span>
    </span>
  );
}
