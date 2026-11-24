import { useEffect, useState } from 'react';
import { handSnapshot } from '../../lib/hand/snapshots.js';
import { STAGE_BACKGROUND } from '../../lib/hand/stage.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT } from '../../i18n/index.jsx';

/** Ảnh bàn tay 3D (chụp từ mô hình) của một ký hiệu, có nền sân khấu giống khung 3D. Tôn trọng kiểu tay, tay trái/phải và tông da trong cài đặt. */
export default function HandSnap({ ch, size = 120, yaw = -10, pitch = 6, className = '', label }) {
  const { settings } = useSettings();
  const { t } = useT();
  const { skin, side, style } = settings.hand;
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setErr(false);
    handSnapshot(ch, { skin, side, style, size: Math.min(512, Math.round(size * 2.4)), yaw, pitch }).then((u) => live && setUrl(u), () => live && setErr(true));
    return () => { live = false; };
  }, [ch, skin, side, style, size, yaw, pitch]);
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ width: size, height: size, background: STAGE_BACKGROUND }}>
      {url ? <img src={url} width={size} height={size} alt={label || `${t('hand.label')} ${ch}`} draggable={false} className="block h-full w-full select-none" /> : (
        <div className="flex h-full w-full items-center justify-center text-muted" aria-hidden>{err ? '—' : <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />}</div>
      )}
    </div>
  );
}
