import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

// Thông báo THUẦN THỊ GIÁC: biểu tượng + chữ ngắn + thanh đếm ngược, không có âm thanh.
const Ctx = createContext(null);
const STYLE = {
  ok: { Icon: CheckCircle2, cls: 'border-ok text-ok', bar: 'bg-ok' },
  warn: { Icon: AlertTriangle, cls: 'border-warn text-warn', bar: 'bg-warn' },
  bad: { Icon: XCircle, cls: 'border-bad text-bad', bar: 'bg-bad' },
  info: { Icon: Info, cls: 'border-info text-info', bar: 'bg-info' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const notify = useCallback((text, kind = 'info', ms = 4000) => {
    const key = ++id.current;
    setItems((a) => [...a.slice(-2), { key, text, kind, ms }]);
    setTimeout(() => setItems((a) => a.filter((x) => x.key !== key)), ms);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-5 z-[95] flex flex-col items-center gap-3 px-4" role="status" aria-live="polite">
        {items.map((t) => {
          const { Icon, cls, bar } = STYLE[t.kind] || STYLE.info;
          return (
            <div key={t.key} className={`animate-rise w-full max-w-xl overflow-hidden rounded-2xl border-2 bg-card shadow-lift ${cls}`}>
              <div className="flex items-center gap-3.5 px-4 py-3.5 text-[1.02rem] font-semibold text-ink">
                <Icon className="h-7 w-7 shrink-0" aria-hidden />
                <span>{t.text}</span>
              </div>
              <div className="h-1.5 bg-card2">
                <div className={`h-full ${bar}`} style={{ animation: `shrink ${t.ms}ms linear forwards` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
