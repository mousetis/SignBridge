import { useEffect, useRef, useState } from 'react';
import { useEsp32 } from '../../context/Esp32Context.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT } from '../../i18n/index.jsx';

const LABEL = {
  LEFT_CLICK: ['cursor.click', 'var(--ok)', 'var(--paper)'],
  DOUBLE_CLICK: ['cursor.double', 'var(--info)', 'var(--paper)'],
  RIGHT_CLICK: ['cursor.right', '255 201 60', '16 20 40'],
  DRAG_START: ['cursor.drag', 'var(--primary)', 'var(--onprimary)'],
  DRAG_END: ['cursor.drop', 'var(--line)', 'var(--paper)'],
};

/** Con trỏ ảo của Joystick: vòng tròn lớn tương phản cao + gợn sóng/nhãn màu khi nhấn (không dùng âm thanh). */
export default function VirtualCursor() {
  const { t } = useT();
  const { cursor, snap } = useEsp32();
  const { settings } = useSettings();
  const el = useRef(null);
  const [fx, setFx] = useState([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => cursor.onAction((a) => {
    if (a.type === 'move') {
      if (el.current) el.current.style.transform = `translate(${a.x}px, ${a.y}px)`;
      return;
    }
    const id = a.at + Math.random();
    setDragging(a.dragging);
    setFx((list) => [...list.slice(-3), { id, x: a.x, y: a.y, action: a.action }]);
    setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), 700);
  }), [cursor]);

  if (snap.state !== 'connected' || !settings.joystick.cursorEnabled || settings.scan.enabled) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[96]" aria-hidden>
      <div ref={el} className="absolute left-0 top-0 will-change-transform" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
        <div className={`absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] ${dragging ? 'border-primary bg-primary/25' : 'border-ink bg-card/50'}`} style={{ boxShadow: '0 0 0 3px rgb(var(--card)), 0 0 0 5px rgb(var(--ink))' }} />
        <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ boxShadow: '0 0 0 3px rgb(var(--card))' }} />
      </div>
      {fx.map((f) => {
        const [key, bg, fg] = LABEL[f.action] || ['', '255 255 255', '0 0 0'];
        const col = bg.startsWith('var') ? `rgb(${bg})` : `rgb(${bg})`;
        return (
          <div key={f.id} className="absolute" style={{ left: f.x, top: f.y }}>
            <div className="absolute h-24 w-24 rounded-full border-[6px]" style={{ borderColor: col, animation: 'ripple .7s ease-out forwards' }} />
            <div className="absolute left-8 top-8 whitespace-nowrap rounded-xl px-3 py-1 text-lg font-extrabold" style={{ background: col, color: `rgb(${fg})` }}>{key && t(key)}</div>
          </div>
        );
      })}
    </div>
  );
}
