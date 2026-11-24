import { useEffect, useRef } from 'react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useEsp32 } from '../../context/Esp32Context.jsx';
import { ScanController } from '../../lib/esp32/scan.js';

/** Chạy chế độ quét khi bật: tự tô sáng lần lượt; thổi (ESP32) hoặc phím Cách để chọn. */
export default function ScanHost() {
  const { settings } = useSettings();
  const { onGesture } = useEsp32();
  const ctl = useRef(null);
  const { enabled, mode, intervalMs } = settings.scan;

  useEffect(() => {
    if (!enabled) return undefined;
    const c = new ScanController({ mode, intervalMs });
    ctl.current = c;
    c.start();
    const key = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.key !== 'Escape' && document.activeElement === e.target && e.key.length === 1) return;
      c.key(e);
    };
    window.addEventListener('keydown', key, true);
    const off = onGesture((ev) => c.gesture(ev));
    return () => {
      window.removeEventListener('keydown', key, true);
      off();
      c.stop();
      ctl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onGesture]);

  useEffect(() => { ctl.current?.configure({ mode, intervalMs }); }, [mode, intervalMs]);
  return null;
}
