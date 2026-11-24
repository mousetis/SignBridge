import { useEffect, useRef } from 'react';
import { Volume2, X, MessageSquare } from 'lucide-react';
import { beautify } from '../../lib/smart.js';
import { useT } from '../../i18n/index.jsx';

/** Khung hội thoại dạng bong bóng: `me` bên phải (màu chủ đạo), `other` bên trái. big = chữ rất lớn (toàn màn hình). */
export default function ChatThread({ messages, names, onSpeak, onRemove, big = false, empty, className = '' }) {
  const { t } = useT();
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length]);
  const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`flex flex-col gap-3 overflow-y-auto ${className}`} role="log" aria-live="polite" aria-label={t('chat.thread')}>
      {messages.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-3 p-6 text-center text-muted">
          <MessageSquare className="h-10 w-10" aria-hidden />
          <p className="max-w-xs text-[1.02rem] font-medium">{empty || t('chat.empty')}</p>
        </div>
      )}
      {messages.map((m) => {
        const me = m.who === 'me';
        const text = beautify(m.text);
        return (
          <div key={m.id} className={`group flex ${me ? 'justify-end' : 'justify-start'} animate-rise`}>
            <div className={`max-w-[88%] rounded-3xl px-5 py-3.5 shadow-card ${me ? 'rounded-br-lg bg-primary text-primary-on' : 'rounded-bl-lg border border-rule bg-card text-ink'}`}>
              <p className={`text-[0.78rem] font-bold uppercase tracking-wider ${me ? 'text-primary-on/75' : 'text-muted'}`}>{names?.[m.who] || m.who} · {fmt(m.at)}{m.src === 'speech' ? ' · 🎤' : m.src === 'sign' ? ' · ✋' : m.src === 'typed' ? ' · ⌨' : ''}</p>
              <p className={`mt-1 break-words font-display font-medium leading-snug ${big ? 'text-[2.6rem]' : 'text-[1.35rem]'}`}>{text}</p>
              <div className="mt-2 flex gap-2 opacity-80 transition group-hover:opacity-100">
                {onSpeak && <button type="button" onClick={() => onSpeak(m.text)} aria-label={t('common.speak')} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/10 hover:bg-black/20"><Volume2 className="h-5 w-5" aria-hidden /></button>}
                {onRemove && <button type="button" onClick={() => onRemove(m.id)} aria-label={t('common.delete')} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/10 hover:bg-black/20"><X className="h-5 w-5" aria-hidden /></button>}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
