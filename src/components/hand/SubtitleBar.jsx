import { useEffect, useRef } from 'react';
import { useT } from '../../i18n/index.jsx';

/** Phụ đề cỡ lớn bên dưới bàn tay 3D; phần đang diễn hoạt (một ký tự hoặc cả một từ đã ghi) được tô như bút dạ quang. */
export default function SubtitleBar({ chars, index, range, playing, fontSize = 36 }) {
  const { t } = useT();
  const activeRef = useRef(null);
  const [a, b] = range || [index, index];
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [a]);

  // gom theo từ để không bị ngắt giữa từ khi xuống dòng
  const words = [];
  let cur = [];
  chars.forEach((c, i) => {
    if (c === ' ') {
      if (cur.length) words.push(cur);
      cur = [];
    } else cur.push({ c, i });
  });
  if (cur.length) words.push(cur);

  return (
    <div className="surface max-h-52 min-h-[104px] overflow-y-auto px-5 py-4" aria-live="off" aria-label={t('text.subtitle')}>
      {chars.length === 0 ? (
        <p className="text-[1.1rem] text-muted">{t('text.empty')}</p>
      ) : (
        <p className="flex flex-wrap gap-x-7 gap-y-3 font-display leading-none" style={{ fontSize }}>
          {words.map((w, wi) => (
            <span key={wi} className="inline-flex whitespace-nowrap">
              {w.map(({ c, i }) => {
                const active = i >= a && i <= b;
                const first = i === a || (w[0].i === i && active);
                return (
                  <span
                    key={i}
                    ref={active && first ? activeRef : null}
                    className={`mx-0.5 inline-flex min-w-[1.1em] items-center justify-center rounded-lg px-1.5 py-1 font-bold transition-[background-color,transform] duration-150 ${
                      active ? `-translate-y-0.5 bg-marker text-[#101428] shadow-press ${playing ? '' : 'opacity-95'}` : i < a ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {c}
                  </span>
                );
              })}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
