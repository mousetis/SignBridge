import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useEsp32 } from '../../context/Esp32Context.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import StatusLight from '../ui/StatusLight.jsx';
import Dialog from '../ui/Dialog.jsx';
import DevicePanel from './DevicePanel.jsx';
import { useT } from '../../i18n/index.jsx';

/** Thanh trạng thái ESP32-S3 (luôn hiển thị) + hộp thoại kết nối. Mặc định ws://192.168.1.100:81/ws, tự nối lại sau 3 giây. */
export default function ConnectionBar({ compact = false }) {
  const { t } = useT();
  const { snap } = useEsp32();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const connected = snap.state === 'connected';
  return (
    <>
      {!compact && <p className="kicker mb-2">{t('device.title')}</p>}
      <button type="button" onClick={() => setOpen(true)} aria-label={t('device.title')} className="block w-full rounded-2xl text-left">
        <StatusLight
          state={snap.state}
          stale={snap.stale}
          extra={connected ? `${t('device.rate', { n: snap.rate })} · ${settings.ip}` : snap.reconnectIn > 0 ? t('device.retry') : settings.ip}
          className="w-full transition hover:brightness-95"
        />
        {!compact && (
          <span className="mt-1.5 flex items-center justify-between px-1 text-[0.9rem] font-semibold text-accent">
            {t('device.detail')} <ChevronRight className="h-5 w-5" aria-hidden />
          </span>
        )}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('device.title')} wide>
        <DevicePanel />
      </Dialog>
    </>
  );
}
