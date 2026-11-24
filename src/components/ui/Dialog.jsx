import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import BigButton from './BigButton.jsx';
import { useT } from '../../i18n/index.jsx';

/** Hộp thoại: trên điện thoại hiện dạng tấm trượt từ dưới lên; giữ tiêu điểm bàn phím trong hộp; Esc để đóng. */
export default function Dialog({ open, onClose, title, children, wide = false }) {
  const { t } = useT();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const h = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', h);
    const tm = setTimeout(() => ref.current?.querySelector('input, select, textarea')?.focus?.(), 50);
    return () => {
      window.removeEventListener('keydown', h);
      clearTimeout(tm);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-stage/70 p-0 backdrop-blur-sm sm:items-start sm:p-10" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-rule bg-card p-6 shadow-lift sm:rounded-3xl sm:p-8 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-rule pb-4">
          <h2 className="text-[1.5rem] leading-tight">{title}</h2>
          <BigButton iconOnly icon={X} variant="ghost" aria-label={t('common.close')} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
